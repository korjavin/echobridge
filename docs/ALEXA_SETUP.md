# Alexa Skill Setup Guide

Since we are running a self-hosted service, you need to manually configure the Alexa Skill in the Amazon Developer Console to point to your server.

## 1. Create a New Skill
1.  Log in to [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask).
2.  Click **Create Skill**.
3.  **Skill Name**: EchoBridge (or any name you like).
4.  **Default Language**: English (US).
5.  **Experience**: "Other" -> "Custom".
6.  **Hosting**: "Provision your own".
7.  Click **Create**.
8.  Choose **Start from Scratch** template.

## 2. Interaction Model
1.  In the left menu, go to **Interaction Model > Invocation**.
    *   **Skill Invocation Name**: `echo bridge` (this is what you say to open it).
2.  Go to **Interaction Model > Intents > JSON Editor**.
3.  Paste the following JSON schema:
    ```json
    {
      "interactionModel": {
        "languageModel": {
          "invocationName": "telegram bridge",
          "intents": [
            {
              "name": "AMAZON.CancelIntent",
              "samples": []
            },
            {
              "name": "AMAZON.HelpIntent",
              "samples": []
            },
            {
              "name": "AMAZON.StopIntent",
              "samples": []
            },
            {
              "name": "AMAZON.NavigateHomeIntent",
              "samples": []
            },
            {
              "name": "ReadMyMessagesIntent",
              "slots": [],
              "samples": [
                "read my messages",
                "read messages",
                "check messages",
                "do I have any messages"
              ]
            },
            {
              "name": "PairDeviceIntent",
              "slots": [],
              "samples": [
                "pair device",
                "connect new device",
                "give me a code"
              ]
            }
          ],
          "types": []
        }
      }
    }
    ```
4.  Click **Save Model** then **Build Model**.

## 3. Interfaces
1.  In the left menu, go to **Interfaces**.
2.  Enable **Audio Player**.
3.  Click **Save Interfaces**.

## 4. Endpoint Configuration
1.  Go to **Build > Endpoint**.
2.  Select **HTTPS**.
3.  **Default Region**: Enter your external URL: `https://alexa.kfamcloud.com/alexa`
    *   *Note: Must end with `/alexa`*
4.  **SSL Certificate**: Select "My development endpoint has a certificate from a trusted authority" (since you are using LetsEncrypt/Traefik).
5.  Click **Save Endpoints**.

## 5. Testing
1.  Go to the **Test** tab.
2.  Enable testing for "Development".
3.  Type or say: `open echo bridge`.
    *   You should hear: "Welcome... Your pairing code is..."
