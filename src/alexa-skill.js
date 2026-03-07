const Alexa = require('ask-sdk-core');
const axios = require('axios');
const crypto = require('crypto');

// Fetch the name of the current person on duty from DUTY_URL
async function fetchDutyName() {
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
    let name = response.data;
    if (typeof name === 'object') {
        name = name.name || name.duty || name.person || name.user;
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new Error('Invalid duty information received');
    }
    return name.trim();
}

// Universal handler — responds to every request with the current duty person
const WhoIsOnDutyHandler = {
    canHandle() {
        return true; // catch all
    },
    async handle(handlerInput) {
        try {
            const name = await fetchDutyName();
            return handlerInput.responseBuilder
                .speak(`Today on duty: ${name}.`)
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
