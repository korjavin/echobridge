# EchoBridge Self-Hosted Deployment Guide

## Overview
We have successfully refuted the complex AWS architecture into a single monolithic Docker container. This service now handles:
- Telegram Bot (receiving messages & voice)
- Alexa Skill (serving content & playback)
- Database (SQLite for pairing & messages)
- Transcoding (FFmpeg OGG -> MP3)

## Prerequisites
- A server with **Docker** and **Docker Compose**.
- A valid **HTTPS** domain (Alexa requirement). You can use Cloudflare Tunnel, Nginx, or Traefik.
- A **Telegram Bot Token** (@BotFather).

## Deployment Steps

We use a standard **GitHub Actions -> GHCR -> Portainer** workflow.

### 1. GitHub Secrets Setup
Go to your repository **Settings > Secrets and variables > Actions** and add:
*   `PORTAINER_REDEPLOY_HOOK`: The webhook URL from your Portainer stack.

### 2. Environment Configuration
On your server (in Portainer stack environment variables), set:
*   `TELEGRAM_BOT_TOKEN`: Your bot token.
*   `HOSTNAME`: Your domain name (e.g., `echo.my-server.com`).
*   `EXTERNAL_URL`: `https://echo.my-server.com`.
*   `NETWORK`: The name of your Traefik/external network (e.g., `proxy_network`).

### 3. Deploy
1.  Push your code to the `master` or `main` branch.
2.  GitHub Actions will:
    *   Build the Docker image and push to `ghcr.io`.
    *   Update `docker-compose.yml` with the new image tag.
    *   Push the updated manifest to the `deploy` branch.
    *   Trigger the Portainer webhook.
3.  Portainer will pull the new image and redeploy.

### 4. Alexa Developer Console Setup
1.  Go to **Build > Endpoint**.
2.  Select **HTTPS**.
3.  Enter your URL: `https://<HOSTNAME>/alexa`.
4.  Select certificate type (usually "My development endpoint has a certificate from a trusted authority").
5.  Save Endpoints.

## Usage Guide
1. **Start**: Say "Alexa, open Telegram Bridge" (or your invocation name).
2. **Pair**: Alexa will say "Your pairing code is XXXXXX".
3. **Telegram**: Send `/pair XXXXXX` to your bot.
4. **Message**: proper Text or Voice message to the bot.
5. **Listen**: Say "Alexa, read messages".

## Implementation Details
- **Codebase**: `src/` contains all logic.
- **Database**: `data/database.sqlite` (persistent volume).
- **Media**: `media/` stores transcoded MP3s (persistent volume).
