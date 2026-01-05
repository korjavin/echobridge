# **Development Brief for Telegram Bot Service**

## **1.0 Objective**

To implement the user-facing Telegram bot for the "EchoBridge" service. This component is responsible for all user interactions, message processing, and communication with the Alexa Skill Backend.

## **2.0 Core Responsibilities**

* Develop an AWS Lambda function (Node.js or Python recommended) that processes webhook updates from the Telegram Bot API.
* Configure an Amazon API Gateway endpoint to act as the public webhook URL for Telegram.

## **3.0 Functional Requirements**

### **3.1 Message Handling**

* The function must be able to parse incoming message updates from Telegram.
* It needs to differentiate between standard text messages and messages containing a voice object.

### **3.2 User Onboarding & State Management**

* The service must maintain a record of registered users to distinguish new users from linked ones. A simple Amazon DynamoDB table mapping the Telegram chat.id to the user's Cognito profile information (including the access and refresh tokens) is the recommended approach.
* **For New Users:** When a message is received from an unknown chat.id, the bot should respond with a welcome message and a unique account linking URL. This URL must be constructed to point to the Cognito Hosted UI's /oauth2/authorize endpoint and include the following query parameters:
  * client_id: The Cognito App Client ID.
  * response_type: code
  * scope: openid+profile+email
  * redirect_uri: The primary Alexa Redirect URL.

### **3.3 Voice Message Processing Pipeline**

This is the most complex part of the bot's functionality and must be implemented precisely.

1. **Detection:** Identify that an incoming message contains a voice object.
2. **Download:** Extract the file_id from the voice object. Use this ID to call the Telegram Bot API's getFile method, which returns a file path. Construct the full download URL and retrieve the .ogg audio file encoded with the OPUS codec.
3. **Transcode:** The downloaded audio file must be transcoded from OGG/OPUS to an Alexa-compatible MP3 format. A recommended target format is MP3 with a 48kbps bitrate and a sample rate of 24000 Hz or 16000 Hz. This will require bundling an audio processing library like a static FFmpeg binary with the Lambda deployment package.
4. **Upload:** Upload the newly created MP3 file to the designated private S3 bucket. The object key should be unique, perhaps using a UUID.
5. **Generate URL:** Create a short-lived (e.g., 5-minute expiry) S3 pre-signed URL that grants temporary read access to the uploaded MP3 file.

### **3.4 Calling the Skill Backend**

* For any message (text or processed voice) from a registered user, the function must make a POST request to the Alexa Skill Backend API endpoint as defined in API_contract.md.
* The request must include the x-api-key header with the correct secret value.
* The request body must be a JSON object conforming to the schema in the API contract.
  * The userAccessToken must be retrieved from the user's stored profile (e.g., from the DynamoDB table).
  * The messageType must be set to TEXT or VOICE accordingly.
  * The payload must contain either the text string or the audioUrl (the S3 pre-signed URL).

## **4.0 Implementation Details**

### **4.1 Required Environment Variables**

* `TELEGRAM_BOT_TOKEN`: The API token from BotFather
* `COGNITO_USER_POOL_ID`: AWS Cognito User Pool ID
* `COGNITO_CLIENT_ID`: Cognito App Client ID
* `S3_BUCKET_NAME`: Name of the S3 bucket for voice file storage
* `ALEXA_SKILL_BACKEND_URL`: API Gateway URL for the Alexa Skill Backend
* `API_KEY`: The API key for authenticating with the Skill Backend
* `COGNITO_DOMAIN`: The Cognito hosted UI domain

### **4.2 Required AWS Permissions**

* DynamoDB read/write access for user state management
* S3 read/write access for voice file storage
* Lambda execution role with CloudWatch Logs permissions

### **4.3 Development Recommendations**

* Use the official Telegram Bot SDK for your chosen language
* Implement proper error handling and logging
* Consider implementing retry logic for external API calls
* Use environment variables for all configuration
* Include FFmpeg as a static binary in your deployment package

## **5.0 Testing Strategy**

* Test with both text and voice messages
* Verify account linking flow with new users
* Test error scenarios (invalid tokens, failed API calls)
* Validate audio transcoding produces correct format
* Ensure S3 pre-signed URLs are accessible

## **6.0 Inputs & Deliverables**

* **Input:** API_contract.md
* **Deliverable:** A deployment package (e.g., a .zip file) containing:
  * AWS Lambda function code
  * All dependencies (node_modules or requirements.txt)
  * Bundled FFmpeg binary for audio processing
  * Infrastructure-as-code file (CloudFormation/SAM template) for:
    * Lambda function deployment
    * DynamoDB table creation
    * IAM roles and policies
    * API Gateway configuration

## **7.0 Success Criteria**

* Bot successfully receives and processes text messages from registered users
* Bot successfully processes voice messages and transcodes them to MP3
* Account linking flow works correctly for new users
* All API calls to Skill Backend conform to the contract specification
* Error handling provides clear feedback to users
* Deployment is automated and repeatable