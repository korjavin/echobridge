const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { skillAdapter } = require('ask-sdk-express-adapter'); // Needs to be installed? Actually ask-sdk-core doesn't include express adapter. 
// Wait, I put ask-sdk-core and model in package.json, but not ask-sdk-express-adapter. 
// I should probably manually handle the request if I don't want to add another dependency, or add it.
// Adding dependency is cleaner. But let's check if I can just use a simple wrapper.
// Wrapper:
const { handler } = require('./alexa-skill');
const bot = require('./telegram-bot');
const db = require('./db');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize DB
db.init().then(() => {
    console.log('Database initialized');
}).catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});

// Telegram Webhook
// We need to tell Telegram where to send updates. 
// This usually happens once via /setWebhook.
// Here we just provide the route.
app.use(bot.webhookCallback('/telegram'));

// Alexa Skill Endpoint
app.post('/alexa', bodyParser.json(), async (req, res) => {
    try {
        const response = await handler.invoke(req.body);
        res.json(response);
    } catch (err) {
        console.error('Alexa processing error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Serve Media Files
app.use('/media', express.static(path.join(__dirname, '../media')));

// Health Check
app.get('/health', (req, res) => {
    res.send('OK');
});

// Start Server
app.listen(PORT, () => {
    console.log(`EchoBridge service running on port ${PORT}`);
    console.log(`Telegram Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? 'PROVIDED' : 'MISSING'}`);
    console.log(`External URL: ${process.env.EXTERNAL_URL}`);

    // Set Telegram webhook if EXTERNAL_URL is present
    if (process.env.EXTERNAL_URL && process.env.TELEGRAM_BOT_TOKEN) {
        const webhookUrl = `${process.env.EXTERNAL_URL}/telegram`;
        bot.telegram.setWebhook(webhookUrl).then(() => {
            console.log(`Telegram webhook set to: ${webhookUrl}`);
        }).catch(err => {
            console.error('Failed to set Telegram webhook:', err);
        });
    }
});
