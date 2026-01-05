const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid');
const db = require('./db');
const pairing = require('./pairing');
const transcoder = require('./transcoder');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Middleware to check if user is registered
const checkRegistration = async (ctx, next) => {
    if (ctx.command === 'pair' || ctx.command === 'start') {
        return next();
    }
    const chatId = ctx.message.chat.id.toString();
    const alexaUserId = await db.getAlexaUserId(chatId);
    if (!alexaUserId) {
        return ctx.reply('⚠️ Access denied. You need to pair your account with Alexa first.\nUse the command: /pair <code>');
    }
    ctx.state.alexaUserId = alexaUserId;
    return next();
};

bot.start((ctx) => {
    ctx.reply(
        'Welcome to EchoBridge! 🌉\n' +
        'To get started, enable the EchoBridge skill on your Alexa device and say "Alexa, pair device".\n' +
        'Then enter the code here using: /pair <code>'
    );
});

bot.command('pair', async (ctx) => {
    const code = ctx.payload.trim();
    if (!code) {
        return ctx.reply('Please provide the 6-digit code. Example: /pair 123456');
    }

    try {
        const result = await pairing.confirmPairing(ctx.message.chat.id.toString(), code);
        if (result.success) {
            ctx.reply(result.message);
        } else {
            ctx.reply('❌ ' + result.message);
        }
    } catch (error) {
        console.error('Pairing error:', error);
        ctx.reply('❌ An internal error occurred during pairing.');
    }
});

bot.use(checkRegistration);

bot.on('text', async (ctx) => {
    try {
        await db.saveMessage(ctx.state.alexaUserId, 'TEXT', ctx.message.text);
        ctx.reply('✅ Text message saved for Alexa.');
    } catch (error) {
        console.error('Error saving text message:', error);
        ctx.reply('❌ Failed to save message.');
    }
});

bot.on('voice', async (ctx) => {
    try {
        ctx.reply('🎤 Processing voice message...');
        const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);

        // Download OGG file
        const tempOggPath = path.join('/tmp', `${uuid.v4()}.ogg`);
        const writer = fs.createWriteStream(tempOggPath);

        const response = await axios({
            url: fileLink.href,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Transcode
        const mp3Filename = `${uuid.v4()}.mp3`;
        await transcoder.transcodeToMp3(tempOggPath, mp3Filename);

        // Save to DB
        // Format of content: just the filename. The Alexa skill (or index.js) will construct the full URL.
        await db.saveMessage(ctx.state.alexaUserId, 'VOICE', mp3Filename);

        // Cleanup temp file
        fs.unlinkSync(tempOggPath);

        ctx.reply('✅ Voice message sent to Alexa.');

    } catch (error) {
        console.error('Error processing voice message:', error);
        ctx.reply('❌ Failed to process voice message.');
    }
});

module.exports = bot;
