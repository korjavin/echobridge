# **EchoBridge**

## **Project Overview**

**EchoBridge** is a self-hosted service that bridges Telegram and Amazon Alexa. It allows you to:
1.  **Read Messages**: Send text to the Telegram bot, and Alexa will read it aloud.
2.  **Play Voice Notes**: Send voice messages to the bot, and Alexa will play them.
3.  **Simple Pairing**: Link your devices using a secure 6-digit code.

## **Architecture**

EchoBridge runs as a single **Docker container** (Monolith) on your own server.
It replaces the complex AWS Lambda/Cognito setup with a lightweight Node.js service containing:
*   **Express Server**: Handles webhooks from Telegram and requests from Alexa.
*   **SQLite Database**: Stores pairing, messages, and user state.
*   **FFmpeg Transcoder**: Converts Telegram OGG voice notes to Alexa-compatible MP3s locally.

## **Getting Started**

### Prerequisites
*   Docker & Docker Compose
*   A public HTTPS URL (required by Alexa Skill) - e.g., via Cloudflare Tunnel.
*   A Telegram Bot Token (@BotFather).

### Quick Start

1.  **Clone & Configure**:
    ```bash
    cp .env.example .env
    # Edit .env with your TELEGRAM_BOT_TOKEN and EXTERNAL_URL
    ```

2.  **Run**:
    ```bash
    docker-compose up -d --build
    ```

3.  **Configure Alexa Skill**:
    *   Point your Alexa Skill Endpoint to `https://<YOUR_URL>/alexa`.
    *   Enable AudioPlayer interface.

4.  **Pair**:
    *   Say "Alexa, open Telegram Bridge" -> Get code.
    *   Send `/pair <code>` to your Telegram Bot.

See [walkthrough.md](walkthrough.md) for detailed deployment instructions.