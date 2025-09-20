# **Step-by-Step Setup Guide**

## **Introduction**

This guide provides comprehensive, step-by-step instructions for the Technical Project Owner to configure all necessary cloud infrastructure and developer accounts for the EchoBridge project. Completing these steps is a prerequisite for the development team to begin their work. It is recommended to have two browser tabs open: one for the AWS Management Console and one for the Alexa Developer Console.

## **Part 1: AWS Infrastructure Setup**

### **1.1 Creating an AWS Account**

If you do not already have one, create an AWS account at [aws.amazon.com](https://aws.amazon.com/). You will need to provide a credit card for billing purposes, although the services used in this project fall comfortably within the AWS Free Tier for typical development and light production usage.

### **1.2 Setting up AWS Cognito for Account Linking**

This is the most critical infrastructure component. Follow these steps carefully.

1. Navigate to the **AWS Cognito** service in the AWS Management Console. Ensure you are in a region that supports Alexa Skills Kit triggers, such as us-east-1 (N. Virginia).
2. Click **Create a user pool**.
3. **Step 1: Configure sign-in experience:**
   * Under **Cognito user pool sign-in options**, select **Email**.
   * Click **Next**.
4. **Step 2: Configure security requirements:**
   * Accept the default password policy or adjust as needed.
   * Set Multi-Factor Authentication (MFA) to **No MFA** for simplicity during development. For production, this should be reconsidered.
   * Click **Next**.
5. **Step 3: Configure sign-up experience:**
   * Leave the defaults and click **Next**.
6. **Step 4: Configure message delivery:**
   * Leave the defaults (Cognito will handle sending verification emails) and click **Next**.
7. **Step 5: Integrate your app:**
   * Enter a **User pool name**, e.g., EchoBridgeUsers.
   * Under **Hosted authentication pages**, check the box for **Use the Cognito Hosted UI**.
   * Under **Domain**, select **Use a Cognito domain**. Enter a unique domain prefix, e.g., echobridge-auth. The full domain will look like echobridge-auth.auth.us-east-1.amazoncognito.com. Note this domain down.
   * Under **App client**, choose **Confidential client**.
   * Enter an **App client name**, e.g., AlexaSkillClient.
   * Ensure **Generate a client secret** is checked.
   * Under **Allowed callback URLs**, enter a temporary placeholder URL like https://localhost. We will replace this later with the real URL from the Alexa Developer Console.
   * Click **Next**.
8. **Step 6: Review and create:**
   * Review all your settings and click **Create user pool**.
9. **Retrieve Credentials:**
   * Once the pool is created, navigate to the **App integration** tab.
   * Select the AlexaSkillClient you created.
   * Note down the **Client ID** and **Client secret**. Store these securely.

### **1.3 Setting up the S3 Bucket for Media**

1. Navigate to the **S3** service in the AWS Management Console.
2. Click **Create bucket**.
3. Enter a globally unique **Bucket name**, e.g., echobridge-voice-media- followed by a random number.
4. Ensure the region matches your other AWS resources.
5. Under **Block Public Access settings for this bucket**, ensure **Block all public access** is checked. The bucket must remain private.
6. Click **Create bucket**.
7. After creation, select the bucket, go to the **Management** tab, and click **Create lifecycle rule**.
8. Name the rule ExpireMediaAfter24Hours.
9. Choose **Apply to all objects in the bucket**.
10. Under **Lifecycle rule actions**, check **Expire current versions of objects**.
11. Enter 1 for **Number of days after object creation**.
12. Click **Create rule**.

### **1.4 Creating IAM Roles**

When deploying the Lambda functions, you will need to create IAM (Identity and Access Management) roles that grant them the necessary permissions. These roles will be created during the Lambda function setup process, but the required permissions are:

* **For the Telegram Bot Lambda:** AWSLambdaBasicExecutionRole, AmazonS3FullAccess (scoped to the media bucket), and permissions to read from a DynamoDB table (if used for user state).
* **For the Alexa Skill Backend Lambda:** AWSLambdaBasicExecutionRole and permissions to make outbound HTTP requests.

## **Part 2: Alexa Skill Configuration**

### **2.1 Registering on the Alexa Developer Console**

If you do not have an account, sign up at [developer.amazon.com/alexa](https://developer.amazon.com/alexa/console/ask) using your Amazon account.

### **2.2 Creating a New Custom Skill**

1. On the console dashboard, click **Create Skill**.
2. Enter a **Skill name**, e.g., EchoBridge Messenger.
3. Choose **Custom** as the model and **Provision your own** as the hosting method.
4. Click **Create skill**.
5. Once in the skill builder, select **Invocation** from the left menu.
6. Set a **Skill Invocation Name**, e.g., my message bridge. This is what users will say to interact with the skill directly. Click **Save Model**.

### **2.3 Configuring the Interaction Model**

1. From the left menu, select **Intents** under the **Interaction Model**.
2. Click **Add Intent**.
3. Select **Create custom intent** and name it ReadMyMessagesIntent.
4. Add a few sample utterances, such as read my messages and what are my new messages.
5. Click **Save Model** and then **Build Model**. This may take a minute.

### **2.4 Enabling Interfaces and Permissions**

1. From the left menu, select **Interfaces**.
2. Toggle the **Audio Player** interface to **Enabled**. Click **Save Interfaces**.
3. From the left menu, select **Permissions**.
4. Scroll down and toggle **Send Alexa Events** to **Enabled**. This is required for sending proactive notifications.

### **2.5 Configuring Account Linking**

This step connects your Alexa Skill to the AWS Cognito User Pool you created.

1. From the left menu, select **Account Linking** under the **TOOLS** section.
2. Toggle on the switch at the top: **Do you allow users to create an account or link to an existing account with you?**.
3. Select **Auth Code Grant** as the authorization grant type.
4. Fill in the **Security Provider Information** form with the details from your Cognito setup:
   * **Authorization URI:** https://<your-cognito-domain>/oauth2/authorize (Replace <your-cognito-domain> with the domain you noted in step 1.2).
   * **Access Token URI:** https://<your-cognito-domain>/oauth2/token.
   * **Client ID:** The Cognito App Client ID you saved.
   * **Client Secret:** The Cognito App Client Secret you saved.
   * **Client Authentication Scheme:** Select **HTTP Basic (Recommended)**.
   * **Scope:** Click **+Add scope** and add openid, profile, and email one by one.
5. Scroll to the bottom of the page. Under **Redirect URLs**, you will see three URLs. Copy all of them.
6. Click **Save** at the top right of the page.

### **2.6 Finalizing Cognito Configuration**

1. Return to the **AWS Cognito** console.
2. Navigate to your EchoBridgeUsers user pool.
3. Go to the **App integration** tab and select your AlexaSkillClient.
4. Click **Edit** in the **Hosted UI** section.
5. In the **Allowed callback URLs** field, remove the placeholder and paste the three Redirect URLs you copied from the Alexa Developer Console.
6. Click **Save changes**.

## **Part 3: Telegram Bot Creation**

### **3.1 Talking to BotFather**

1. In the Telegram app, search for the user @BotFather (it will have a blue verification checkmark).
2. Start a chat and send the command /newbot.
3. Follow the prompts to choose a name (e.g., EchoBridge Bot) and a username (e.g., MyEchoBridgeBot, which must be unique and end in "bot").

### **3.2 Retrieving the API Token**

BotFather will respond with a confirmation message that includes your bot's **API token**. This token is highly sensitive. Copy it and store it securely. It will be used as an environment variable for the Telegram Bot Lambda function.

## **Part 4: Deployment & Final Configuration**

The development team will provide the code for the two AWS Lambda functions. The final steps involve deploying this code and configuring the system.

1. **Deploy Lambda Functions:** Deploy the provided code packages to AWS Lambda.
2. **Configure Environment Variables:** For each Lambda function, configure the necessary environment variables in the Lambda console's **Configuration > Environment variables** section. This will include the Telegram Bot Token, Cognito User Pool ID, S3 Bucket Name, and the API Gateway URL for the Skill Backend.
3. **Set up API Gateways:** Create API Gateway triggers for both Lambda functions. The Telegram bot's API Gateway will be configured as a webhook, while the Skill Backend's API Gateway will be configured with an API key.
4. **Update Endpoints:**
   * In the Alexa Developer Console, under the **Endpoint** section, paste the ARN of your deployed Alexa Skill Backend Lambda function.
   * In Telegram, use the BotFather /setwebhook command to point your bot to the API Gateway URL for your Telegram Bot Lambda function.

Your EchoBridge service is now fully configured and ready for testing.