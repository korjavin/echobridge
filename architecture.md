# **System Architecture**

## **1.0 System Architecture Overview**

The EchoBridge architecture is designed as a distributed, event-driven system composed of three primary domains: the **User Interface (Telegram)**, the **EchoBridge Service (AWS)**, and the **Alexa Cloud (Amazon)**. The system relies on secure, well-defined API calls to pass information between these domains.

The general data flow for a message is as follows:

1. A user sends a message (text or voice) to the EchoBridge bot on Telegram.
2. The Telegram Bot Service, running on AWS Lambda, receives the message.
3. The service processes the message. If it's a voice message, it is downloaded, transcoded, and stored temporarily in Amazon S3.
4. The Bot Service then makes a secure API call to the Alexa Skill Backend Service, also running on AWS Lambda.
5. The Skill Backend authenticates the request and forwards the message content to the appropriate Alexa API—the Proactive Events API for text or the AudioPlayer interface for voice.
6. The Alexa Cloud processes the request and delivers the notification or audio playback to the user's linked Echo devices.

This decoupled architecture ensures that each component has a single responsibility, enhancing maintainability, scalability, and security.

## **2.0 Component Deep Dive**

### **2.1 Authentication & Identity Service (AWS Cognito)**

The cornerstone of the EchoBridge architecture is its approach to user identity and security. AWS Cognito, a fully managed identity service, is employed to handle all aspects of user registration and authentication, thereby fulfilling the critical requirement of secure account linking without handling user credentials.

* **Rationale for Use:** A dedicated authentication service like Cognito provides a robust and secure implementation of the OAuth 2.0 standard out-of-the-box. Building a custom OAuth 2.0 server is complex and fraught with security risks; leveraging a managed service is the industry best practice.
* **Implementation Details:** An AWS Cognito User Pool will be configured to manage user profiles for the EchoBridge service. Each user who links their account will have a unique profile created within this pool. The service establishes a link between a user's Telegram ID and their Cognito profile, which is in turn linked to their Amazon account via the OAuth 2.0 flow.
* **OAuth 2.0 Flow:** The system will implement the **Authorization Code Grant** flow, which is the most secure and recommended method for this type of application. In this flow, the roles are clearly defined:
  * **Resource Owner:** The end-user who owns both their Telegram and Amazon accounts.
  * **Client:** The Alexa service, which is requesting access to the user's EchoBridge profile on their behalf.
  * **Authorization Server:** AWS Cognito, which authenticates the user and issues access tokens.
  * **Resource Server:** The EchoBridge Alexa Skill Backend, which protects the user's data and requires a valid access token to perform actions.

This flow operates as a "trust broker" model. The EchoBridge service itself never needs to know the user's Amazon password. Instead, when a user initiates account linking, they are redirected to a secure login page hosted by Cognito. After successful authentication, Cognito provides an authorization code to the Alexa service. Alexa then exchanges this code for an access token, which it includes in all subsequent requests to the EchoBridge backend. The backend can then validate this token with Cognito to confirm the user's identity, ensuring a secure and decoupled authentication process.

### **2.2 Telegram Bot Service (AWS Lambda)**

This component serves as the primary user-facing entry point for the system. It will be implemented as a serverless AWS Lambda function, triggered via an Amazon API Gateway webhook that is registered with the Telegram Bot API.

* **Core Logic:**
  * **Message Reception:** The function will be configured to receive all incoming messages from users.
  * **Onboarding:** For first-time users, the bot will respond with a welcome message and a unique account linking URL that directs them to the Cognito-hosted authentication page.
  * **Message Forwarding:** For registered users, the function will parse the incoming message and forward it to the Alexa Skill Backend according to the defined API_contract.md.
  * **Voice Processing:** It is responsible for handling voice objects within Telegram messages. This involves using the file_id provided by the Telegram API to download the audio file for further processing.

### **2.3 Alexa Skill Backend Service (API Gateway & AWS Lambda)**

This service is the central processing hub of the EchoBridge system. It consists of a RESTful API endpoint exposed via Amazon API Gateway, which is secured and triggers a dedicated AWS Lambda function for processing.

* **API Security:** The API Gateway endpoint will be configured to require an API key. This prevents unauthorized or malicious actors from invoking the backend function directly, ensuring that only the trusted Telegram Bot Service can send requests.
* **Core Logic:**
  * **Request Validation:** The Lambda function first validates the incoming request, checking for a valid API key and a well-formed request body.
  * **Message Routing:** It parses the messageType field in the request payload to determine whether to handle a text or voice message.
  * **Text Message Handling:** For text messages, the function authenticates with the Alexa service using a client credentials grant and then makes a POST request to the Proactive Events API to create a new notification event.
  * **Voice Message Handling:** For voice messages, the function constructs an AudioPlayer.Play directive containing the URL of the audio file and returns it in its response to the Alexa service.

### **2.4 Media Processing & Storage (S3 & Transcoding)**

A critical architectural consideration arises from the incompatibility between the audio formats used by Telegram and Alexa. This necessitates a dedicated media processing pipeline.

* **Format Incompatibility:** Telegram voice messages are delivered in an Ogg container with the OPUS codec. The Alexa AudioPlayer interface, however, does not support this format. It requires standard formats such as MP3, AAC/MP4, or HLS.
* **Transcoding Step:** To resolve this, the Telegram Bot Lambda function must perform an on-the-fly audio transcoding step. After downloading the .ogg file from Telegram, it will use a bundled audio processing library (such as a static FFmpeg binary) to convert the file into a compatible MP3 format (e.g., 48kbps bitrate, 24000Hz sample rate).
* **Secure Temporary Storage:** The resulting MP3 file cannot be sent directly in an API payload. Instead, it will be uploaded to a private Amazon S3 bucket. To grant the Alexa service temporary access to this private file, the Lambda function will generate a **pre-signed S3 URL**. This is a time-limited URL that provides secure, temporary read access to a specific object in the bucket without exposing the entire bucket publicly. This URL is then passed to the Alexa Skill Backend. The S3 bucket will also be configured with a lifecycle policy to automatically delete files after 24 hours to manage costs and ensure user data is not retained unnecessarily.

## **3.0 Sequence Diagrams**

### **3.1 Flow 1: First-Time User Registration & Account Linking**

1. **User** -> **Telegram Bot:** Sends /start command.
2. **Telegram Bot** -> **User:** Responds with a welcome message and a unique account linking URL.
3. **User:** Clicks the URL, which opens the Cognito Hosted UI login page in their browser.
4. **User** -> **Cognito:** Enters their credentials and authenticates.
5. **Cognito** -> **User's Browser:** Redirects back to the Alexa Redirect URL, including an authorization_code in the query parameters.
6. **Alexa Service:** Receives the authorization_code.
7. **Alexa Service** -> **Cognito:** Exchanges the authorization_code (along with its client ID and secret) for an access_token and refresh_token.
8. **Cognito** -> **Alexa Service:** Returns the tokens.
9. **Alexa Service:** Securely stores the tokens for the user and confirms the account link is successful. The user is now registered.

### **3.2 Flow 2: Text Message Delivery**

1. **User** -> **Telegram Bot:** Sends a text message (e.g., "Dinner is at 7").
2. **Telegram Bot Service (Lambda):** Receives the message, identifies the registered user, and retrieves their stored access_token.
3. **Telegram Bot Service** -> **Alexa Skill Backend (API Gateway):** Makes a POST request to /v1/message with the userAccessToken, messageType: "TEXT", and the message content in the payload.
4. **Alexa Skill Backend (Lambda):** Validates the request.
5. **Alexa Skill Backend** -> **Login with Amazon (LWA):** Obtains a service-level access token with the alexa::proactive_events scope.
6. **Alexa Skill Backend** -> **Alexa Proactive Events API:** Sends a createEvent request using the AMAZON.MessageAlert.Activated schema, targeting the specific user identified by the userAccessToken.
7. **Alexa Cloud:** Processes the event and triggers a notification (yellow ring) on the user's Echo devices.

### **3.3 Flow 3: Voice Message Delivery**

1. **User** -> **Telegram Bot:** Sends a voice note.
2. **Telegram Bot Service (Lambda):** Receives the message containing a voice object with a file_id.
3. **Telegram Bot Service** -> **Telegram API:** Uses the file_id to get a file path and downloads the .ogg audio file.
4. **Telegram Bot Service:** Transcodes the .ogg file to an MP3 format.
5. **Telegram Bot Service** -> **Amazon S3:** Uploads the new MP3 file to the designated private bucket.
6. **Telegram Bot Service:** Generates a 5-minute pre-signed URL for the uploaded MP3 file.
7. **Telegram Bot Service** -> **Alexa Skill Backend (API Gateway):** Makes a POST request to /v1/message with the userAccessToken, messageType: "VOICE", and the S3 pre-signed URL in the payload.
8. **Alexa Skill Backend (Lambda):** Validates the request and constructs an AudioPlayer.Play directive. The audioItem.stream.url is set to the received pre-signed URL.
9. **Alexa Skill Backend** -> **Alexa Cloud:** Returns the response containing the AudioPlayer.Play directive.
10. **Alexa Cloud:** The Alexa service streams the audio directly from the secure S3 URL and plays it on the user's Echo devices.