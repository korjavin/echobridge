const Alexa = require('ask-sdk-core');
const db = require('./db');
const pairing = require('./pairing');

// Helper to get Alexa User ID
const getUserId = (handlerInput) => {
    return handlerInput.requestEnvelope.context.System.user.userId;
};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        const userId = getUserId(handlerInput);
        const telegramChatId = await db.getTelegramChatId(userId);

        if (telegramChatId) {
            const messages = await db.getUnreadMessages(userId);
            const count = messages.length;
            const speakOutput = `Welcome back to EchoBridge. You have ${count} new message${count !== 1 ? 's' : ''}. Say "read messages" to hear them.`;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        } else {
            // Not paired, generate code
            const code = await pairing.startPairing(userId);
            const speakOutput = `Welcome to EchoBridge. I am not linked to your Telegram account yet. Your pairing code is <say-as interpret-as="digits">${code}</say-as>. Please send this code to the EchoBridge Telegram bot.`;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        }
    }
};

const ReadMyMessagesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'ReadMyMessagesIntent';
    },
    async handle(handlerInput) {
        const userId = getUserId(handlerInput);
        const telegramChatId = await db.getTelegramChatId(userId);

        if (!telegramChatId) {
            return handlerInput.responseBuilder
                .speak('You are not paired yet. Please invoke the skill again to get a pairing code.')
                .getResponse();
        }

        const messages = await db.getUnreadMessages(userId);

        if (messages.length === 0) {
            return handlerInput.responseBuilder
                .speak('You have no new messages.')
                .getResponse();
        }

        const message = messages[0]; // Play one by one

        // Mark as read immediately (or could wait for playback finished)
        // For simplicity in this v1, checking "next message" flow is complex, so we just play one.
        // A better UX would be to loop, but let's stick to functional MVP.
        await db.markMessageAsRead(message.id);

        if (message.type === 'TEXT') {
            const speakOutput = `Message from Telegram: ${message.content}`;
            return handlerInput.responseBuilder
                .speak(speakOutput)
                // .reprompt('Would you like to hear the next message?') // Logic for next message would go here
                .getResponse();
        } else if (message.type === 'VOICE') {
            const externalUrl = process.env.EXTERNAL_URL || 'https://example.com';
            // Ensure no trailing slash
            const baseUrl = externalUrl.replace(/\/$/, '');
            const audioUrl = `${baseUrl}/media/${message.content}`;

            // Using AudioPlayer to play the file
            return handlerInput.responseBuilder
                .speak('Playing voice message...')
                .addAudioPlayerPlayDirective('REPLACE_ALL', audioUrl, message.id.toString(), 0)
                .getResponse();
        }
    }
};

const PairDeviceIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PairDeviceIntent'; // Need to ensure user adds this if not exists
    },
    async handle(handlerInput) {
        const userId = getUserId(handlerInput);
        const code = await pairing.startPairing(userId);
        const speakOutput = `Your pairing code is <say-as interpret-as="digits">${code}</say-as>. Please send this code to the EchoBridge Telegram bot.`;
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can ask me to read your messages or pair your device. How can I help?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
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

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        ReadMyMessagesIntentHandler,
        PairDeviceIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .create();
