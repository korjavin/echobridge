const Alexa = require('ask-sdk-core');
const axios = require('axios');
const crypto = require('crypto');

// Fetch the name and chores of the current person on duty from DUTY_URL
async function fetchDutyInfo() {
    const dutyUrl = process.env.DUTY_URL;
    if (!dutyUrl) {
        throw new Error('DUTY_URL is not configured');
    }

    const headers = {};
    const secret = process.env.DUTY_SECRET;
    if (secret) {
        const timestamp = Date.now().toString();
        const signature = crypto.createHmac('sha256', secret)
            .update(timestamp)
            .digest('hex');
        headers['X-Timestamp'] = timestamp;
        headers['X-Signature'] = signature;
    }

    const response = await axios.get(dutyUrl, { timeout: 3000, headers });
    let data = response.data;
    let name;
    let chores = [];

    if (typeof data === 'object' && data !== null) {
        name = data.name || data.duty || data.person || data.user;
        if (Array.isArray(data.chores)) {
            chores = data.chores;
        }
    } else {
        name = data;
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new Error('Invalid duty information received');
    }

    return { name: name.trim(), chores };
}

// Universal handler — responds to every request with the current duty person
const WhoIsOnDutyHandler = {
    canHandle() {
        return true; // catch all
    },
    async handle(handlerInput) {
        try {
            const { name, chores } = await fetchDutyInfo();
            let speechText = `Today on duty: ${name}.`;

            if (chores && chores.length > 0) {
                chores.forEach(chore => {
                    let choreParts = [];
                    if (chore.description) choreParts.push(chore.description);
                    if (chore.assignee) choreParts.push(`assigned to ${chore.assignee}`);
                    if (chore.deadline_at) choreParts.push(`due ${chore.deadline_at}`);

                    if (choreParts.length > 0) {
                        speechText += ` ${choreParts.join(', ')}.`
                    }
                });
            }

            return handlerInput.responseBuilder
                .speak(speechText)
                .getResponse();
        } catch (error) {
            console.error('Failed to fetch duty information:', error.message);
            return handlerInput.responseBuilder
                .speak('Sorry, I could not get the duty information right now.')
                .getResponse();
        }
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.stack}`);
        return handlerInput.responseBuilder
            .speak('Sorry, something went wrong. Please try again.')
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(WhoIsOnDutyHandler)
    .addErrorHandlers(ErrorHandler)
    .create();
