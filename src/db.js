const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function init() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Table for paired users: maps Telegram Chat ID <-> Alexa User ID
            db.run(`CREATE TABLE IF NOT EXISTS pairs (
                telegram_chat_id TEXT PRIMARY KEY,
                alexa_user_id TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Table for pending codes: maps Code <-> Alexa User ID
            db.run(`CREATE TABLE IF NOT EXISTS pending_codes (
                code TEXT PRIMARY KEY,
                alexa_user_id TEXT NOT NULL,
                expires_at DATETIME NOT NULL
            )`);

            // Table for messages: stores text or voice messages
            db.run(`CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alexa_user_id TEXT NOT NULL,
                type TEXT NOT NULL, -- 'TEXT' or 'VOICE'
                content TEXT NOT NULL, -- Text content or filename
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

function savePairingCode(code, alexaUserId) {
    return new Promise((resolve, reject) => {
        // Code expires in 5 minutes
        const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
        const stmt = db.prepare('INSERT OR REPLACE INTO pending_codes (code, alexa_user_id, expires_at) VALUES (?, ?, ?)');
        stmt.run(code, alexaUserId, expiresAt, (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

function getPairingRequest(code) {
    return new Promise((resolve, reject) => {
        db.get('SELECT alexa_user_id FROM pending_codes WHERE code = ? AND expires_at > ?', [code, new Date().toISOString()], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.alexa_user_id : null);
        });
    });
}

function createPair(telegramChatId, alexaUserId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare('INSERT OR REPLACE INTO pairs (telegram_chat_id, alexa_user_id) VALUES (?, ?)');
        stmt.run(telegramChatId, alexaUserId, (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

function getAlexaUserId(telegramChatId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT alexa_user_id FROM pairs WHERE telegram_chat_id = ?', [telegramChatId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.alexa_user_id : null);
        });
    });
}

function getTelegramChatId(alexaUserId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT telegram_chat_id FROM pairs WHERE alexa_user_id = ?', [alexaUserId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.telegram_chat_id : null);
        });
    });
}

function saveMessage(alexaUserId, type, content) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare('INSERT INTO messages (alexa_user_id, type, content) VALUES (?, ?, ?)');
        stmt.run(alexaUserId, type, content, function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
        stmt.finalize();
    });
}

function getUnreadMessages(alexaUserId) {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM messages WHERE alexa_user_id = ? AND is_read = 0 ORDER BY created_at ASC', [alexaUserId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function markMessageAsRead(messageId) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE messages SET is_read = 1 WHERE id = ?', [messageId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function removeCode(code) {
    db.run('DELETE FROM pending_codes WHERE code = ?', [code]);
}

module.exports = {
    init,
    savePairingCode,
    getPairingRequest,
    createPair,
    getAlexaUserId,
    getTelegramChatId,
    saveMessage,
    getUnreadMessages,
    markMessageAsRead,
    removeCode
};
