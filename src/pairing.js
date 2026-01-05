const db = require('./db');

function generateCode() {
    // Generate a 6-digit number
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function startPairing(alexaUserId) {
    const code = generateCode();
    await db.savePairingCode(code, alexaUserId);
    return code;
}

async function confirmPairing(telegramChatId, code) {
    const alexaUserId = await db.getPairingRequest(code);

    if (!alexaUserId) {
        return { success: false, message: 'Invalid or expired code.' };
    }

    await db.createPair(telegramChatId, alexaUserId);
    await db.removeCode(code); // One-time use

    return { success: true, message: 'Successfully paired!' };
}

module.exports = {
    startPairing,
    confirmPairing
};
