# **Development Brief for Alexa Skill Backend**

## **1.0 Objective**

To implement the backend service for the "EchoBridge" Alexa Skill. This service functions as the secure, central hub that receives processed messages from the Telegram Bot Service and translates them into commands for the Alexa platform.

## **2.0 Core Responsibilities**

* Develop an AWS Lambda function (Node.js or Python recommended) that serves as the custom skill's primary endpoint and the target for the internal API.
* Implement the API endpoint specified in API_contract.md, exposing it via Amazon API Gateway and securing it with an API key.
* Process incoming requests, routing them to the appropriate handler based on the messageType field.

## **3.0 Functional Requirements**

### **3.1 Text Message Handling**

* Upon receiving a request with messageType: "TEXT", the function must construct and send a Proactive Event to the Alexa Events Gateway.
* The event must use the AMAZON.MessageAlert.Activated schema. The payload should be structured to indicate a new message, for example:
  ```json
  {
    "state": { "status": "UNREAD", "freshness": "NEW" },
    "messageGroup": {
      "creator": { "name": "EchoBridge" },
      "count": 1
    }
  }
  ```

* To send the event, the service must first obtain an access token from the Login with Amazon (LWA) service using a client credentials grant. This request must specify the alexa::proactive_events scope. The Client ID and Client Secret for this grant are obtained from the skill's permissions page.
* The Proactive Event must be targeted at a specific user. The relevantAudience type should be Unicast, and the userId should be extracted by using the userAccessToken from the API request to query the Cognito /oauth2/userInfo endpoint or a similar user info endpoint provided by the OAuth provider.

### **3.2 Voice Message Handling**

* Upon receiving a request with messageType: "VOICE", the function must construct a response containing an AudioPlayer.Play directive.
* The audioItem.stream.url property of the directive must be set to the pre-signed S3 URL provided in the payload.audioUrl field of the incoming request.
* A unique token should be generated for the audioItem.stream.token to identify this specific playback instance.
* The response containing this directive should be returned to the Alexa service. Crucially, the shouldEndSession flag in the main response body must be set to true to allow the audio to play without Alexa waiting for a further voice command.

### **3.3 Handling User Invocation**

* The Lambda function must also serve as the standard endpoint for the Alexa Skill. It should include a handler for the LaunchRequest and the custom ReadMyMessagesIntent.
* The logic for these handlers can be simple, as the primary delivery mechanism is the proactive notification. A suitable response would be a simple voice prompt, such as, "You have new messages from EchoBridge. Please check the notifications in your Alexa app for details."

## **4.0 Implementation Details**

### **4.1 Required Environment Variables**

* `COGNITO_USER_POOL_ID`: AWS Cognito User Pool ID for token validation
* `LWA_CLIENT_ID`: Login with Amazon Client ID for proactive events
* `LWA_CLIENT_SECRET`: Login with Amazon Client Secret
* `ALEXA_EVENTS_ENDPOINT`: Alexa Events Gateway endpoint URL
* `API_KEY`: Expected API key for internal endpoint security

### **4.2 Required AWS Permissions**

* Lambda execution role with CloudWatch Logs permissions
* Permission to make outbound HTTPS requests to Alexa APIs
* Permission to validate tokens with Cognito (if using Cognito token validation)

### **4.3 API Endpoint Implementation**

The Lambda function must handle two types of requests:

1. **Internal API calls** from the Telegram Bot Service (POST /v1/message)
2. **Alexa Skill requests** from the Alexa service (skill invocations)

Use request routing logic to differentiate between these request types and handle them appropriately.

### **4.4 Development Recommendations**

* Use the official Alexa Skills Kit SDK for your chosen language
* Implement proper request validation and error handling
* Use structured logging for debugging and monitoring
* Implement token caching for LWA access tokens (they're valid for 1 hour)
* Consider implementing dead letter queues for failed proactive events

## **5.0 Technical Implementation Guide**

### **5.1 Proactive Events Flow**

1. Receive POST request to /v1/message with TEXT messageType
2. Validate API key and request structure
3. Extract userAccessToken from request
4. Obtain LWA access token with alexa::proactive_events scope
5. Query user information to get userId for targeting
6. Construct AMAZON.MessageAlert.Activated event
7. Send event to Alexa Events Gateway
8. Return 202 Accepted response

### **5.2 Voice Message Flow**

1. Receive POST request to /v1/message with VOICE messageType
2. Validate API key and request structure
3. Extract audioUrl from payload
4. Construct AudioPlayer.Play directive with the provided URL
5. Return directive response with shouldEndSession: true

### **5.3 Skill Invocation Flow**

1. Receive Alexa skill request (LaunchRequest or ReadMyMessagesIntent)
2. Validate request signature (using Alexa SDK)
3. Return appropriate speech response
4. Handle session management

## **6.0 Error Handling**

* **400 Bad Request**: Invalid request structure or missing required fields
* **401 Unauthorized**: Invalid or missing API key
* **403 Forbidden**: API Gateway-level rejection
* **500 Server Error**: Internal processing errors

Implement comprehensive error logging and return descriptive error messages as specified in the API contract.

## **7.0 Testing Strategy**

* Unit tests for request validation and routing logic
* Integration tests with mock Alexa Events Gateway
* Test account linking token validation
* Test audio directive construction
* Validate proactive events are properly formatted
* Test error scenarios and response codes

## **8.0 Monitoring and Observability**

* CloudWatch metrics for request volume and error rates
* Custom metrics for proactive event success/failure rates
* Structured logging for debugging failed requests
* Alerts for high error rates or failed LWA token requests

## **9.0 Inputs & Deliverables**

* **Input:** API_contract.md
* **Deliverable:** A deployment package (e.g., a .zip file) containing:
  * AWS Lambda function code
  * All dependencies (node_modules or requirements.txt)
  * Infrastructure-as-code file (CloudFormation/SAM template) for:
    * Lambda function deployment
    * API Gateway configuration with API key
    * IAM roles and policies
    * CloudWatch log groups

## **10.0 Success Criteria**

* API endpoint correctly implements the contract specification
* Text messages trigger proactive notifications on Alexa devices
* Voice messages play correctly through AudioPlayer interface
* Skill invocation works for basic user interactions
* All error scenarios return appropriate HTTP status codes
* Token validation works correctly with Cognito
* Deployment is automated and repeatable
* Comprehensive logging and monitoring is in place