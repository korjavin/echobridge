const Alexa = require('ask-sdk-core');
const axios = require('axios');

// Environment variables
const {
    LWA_CLIENT_ID,
    LWA_CLIENT_SECRET,
    ALEXA_EVENTS_ENDPOINT,
    API_KEY,
    COGNITO_USER_POOL_ID
} = process.env;

const InternalApiHandler = {
    canHandle(handlerInput) {
        // Identify internal API requests
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest' &&
               handlerInput.requestEnvelope.request.body &&
               handlerInput.requestEnvelope.request.body.messageType;
    },
    async handle(handlerInput) {
        const { messageType, payload, userAccessToken } = handlerInput.requestEnvelope.request.body;
        const requestId = Alexa.getRequestId(handlerInput.requestEnvelope);

        try {
            if (messageType === 'TEXT') {
                // 1. Get LWA Access Token
                const lwaToken = await getLwaToken();

                // 2. Get userId
                const userId = await getUserId(userAccessToken);

                // 3. Send Proactive Event
                await sendProactiveEvent(lwaToken, userId, payload.text, requestId);

                return {
                    statusCode: 202,
                    body: JSON.stringify({ status: 'success', messageId: requestId }),
                };

            } else if (messageType === 'VOICE') {
                const audioUrl = payload.audioUrl;
                const token = requestId;

                // Validate audio URL
                if (!audioUrl || !audioUrl.startsWith('https://')) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ status: 'error', message: 'Invalid audio URL' }),
                    };
                }

                return {
                    statusCode: 202,
                    body: JSON.stringify({
                        status: 'success',
                        messageId: requestId,
                        response: {
                            shouldEndSession: true,
                            directives: [{
                                type: 'AudioPlayer.Play',
                                playBehavior: 'REPLACE_ALL',
                                audioItem: {
                                    stream: {
                                        url: audioUrl,
                                        token: token,
                                        offsetInMilliseconds: 0
                                    }
                                }
                            }]
                        }
                    }),
                };
            } else {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ status: 'error', message: 'Invalid messageType' }),
                };
            }
        } catch (error) {
            console.error('Error processing internal API request:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ status: 'error', message: 'Internal Server Error' }),
            };
        }
    }
};


const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Welcome to Echo Bridge. You can ask me to read your messages.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const ReadMyMessagesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ReadMyMessagesIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You have new messages from EchoBridge. Please check the notifications in your Alexa app for details.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.stack}`);
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// Helper functions
async function getLwaToken() {
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', LWA_CLIENT_ID);
        params.append('client_secret', LWA_CLIENT_SECRET);
        params.append('scope', 'alexa::proactive_events');

        const { data } = await axios.post('https://api.amazon.com/auth/o2/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
        });
        return data.access_token;
    } catch (error) {
        console.error('Error getting LWA token:', error.response?.data || error.message);
        throw new Error('Failed to obtain LWA access token');
    }
}

async function getUserId(userAccessToken) {
    // For Cognito tokens, we need to get user info from Cognito userInfo endpoint
    // The userAccessToken should be validated with Cognito to get the user ID
    try {
        const { data } = await axios.get(`https://cognito-idp.us-east-1.amazonaws.com/`, {
            headers: {
                'Authorization': `Bearer ${userAccessToken}`
            }
        });
        return data.sub; // Cognito user ID
    } catch (error) {
        console.error('Error getting user ID from token:', error);
        // Fallback: extract user ID from JWT token without validation (for demo purposes)
        const tokenParts = userAccessToken.split('.');
        if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            return payload.sub;
        }
        throw new Error('Invalid access token');
    }
}

async function sendProactiveEvent(lwaToken, userId, message, requestId) {
    try {
        const event = {
            timestamp: new Date().toISOString(),
            referenceId: requestId,
            expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            event: {
                name: 'AMAZON.MessageAlert.Activated',
                payload: {
                    state: {
                        status: 'UNREAD',
                        freshness: 'NEW'
                    },
                    messageGroup: {
                        creator: {
                            name: 'EchoBridge'
                        },
                        count: 1,
                    }
                }
            },
            localizedAttributes: [{
                locale: 'en-US',
                'spokenInfo': {
                    'content': [{
                        'locale': 'en-US',
                        'text': `You have a new message from EchoBridge: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`
                    }]
                }
            }],
            relevantAudience: {
                type: 'Unicast',
                payload: {
                    user: userId
                }
            }
        };

        const response = await axios.post(ALEXA_EVENTS_ENDPOINT, event, {
            headers: {
                'Authorization': `Bearer ${lwaToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        console.log('Proactive event sent successfully:', response.status);
    } catch (error) {
        console.error('Error sending proactive event:', error.response?.data || error.message);
        throw new Error('Failed to send proactive notification');
    }
}


const skillBuilder = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        InternalApiHandler,
        LaunchRequestHandler,
        ReadMyMessagesIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(
        ErrorHandler
    );

exports.handler = async (event, context) => {
    // Route internal API calls
    if (event.headers && event.headers['x-api-key']) {
        if (event.headers['x-api-key'] !== API_KEY) {
            return {
                statusCode: 401,
                body: JSON.stringify({ status: 'error', message: 'Unauthorized' }),
            };
        }
        const body = JSON.parse(event.body);
        const fakeHandlerInput = {
            requestEnvelope: {
                request: {
                    type: 'LaunchRequest', // We trick the canHandle to check this
                    body: body,
                    requestId: context.awsRequestId
                },
                context: { System: {} },
                session: {},
                version: '1.0'
            },
            context: context
        };
        return await InternalApiHandler.handle(fakeHandlerInput);
    }
    // Route Alexa skill requests
    return skillBuilder.lambda()(event, context);
};
