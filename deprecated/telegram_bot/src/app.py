import json
import os
import boto3
import requests
import uuid
import subprocess
import urllib.parse

# Environment variables
TELEGRAM_BOT_TOKEN = os.environ['TELEGRAM_BOT_TOKEN']
USER_TABLE_NAME = os.environ['USER_TABLE_NAME']
S3_BUCKET_NAME = os.environ['S3_BUCKET_NAME']
ALEXA_SKILL_BACKEND_URL = os.environ['ALEXA_SKILL_BACKEND_URL']
API_KEY = os.environ['API_KEY']
COGNITO_DOMAIN = os.environ['COGNITO_DOMAIN']
COGNITO_CLIENT_ID = os.environ['COGNITO_CLIENT_ID']
ALEXA_REDIRECT_URI = os.environ['ALEXA_REDIRECT_URI']

# AWS clients
dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')
user_table = dynamodb.Table(USER_TABLE_NAME)

# Telegram API URL
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

def lambda_handler(event, context):
    """
    Main Lambda function handler for processing Telegram updates and user registrations.
    """
    try:
        path = event.get('path', '/')
        body = json.loads(event.get('body', '{}'))

        if path == '/register':
            return register_user(body)

        message = body.get('message', {})
        chat_id = message.get('chat', {}).get('id')

        if not chat_id:
            return {'statusCode': 200, 'body': 'OK'}

        user_profile = get_user_profile(str(chat_id))

        if not user_profile:
            handle_new_user(chat_id)
        else:
            handle_registered_user(message, user_profile)

    except Exception as e:
        print(f"Error: {e}")

    return {'statusCode': 200, 'body': 'OK'}


def register_user(body):
    """
    Registers a new user by storing their tokens in DynamoDB.
    This endpoint should be called by the Alexa Skill Backend.
    """
    chat_id = body.get('chat_id')
    access_token = body.get('access_token')
    refresh_token = body.get('refresh_token')

    if not all([chat_id, access_token, refresh_token]):
        return {'statusCode': 400, 'body': json.dumps({'status': 'error', 'message': 'Missing required fields.'})}

    try:
        user_table.put_item(
            Item={
                'chat_id': str(chat_id),
                'access_token': access_token,
                'refresh_token': refresh_token
            }
        )
        # Notify the user that the linking was successful
        send_telegram_message(chat_id, "✅ Your account has been successfully linked! You can now send me text or voice messages to forward to your Alexa devices.")
        return {'statusCode': 200, 'body': json.dumps({'status': 'success'})}
    except Exception as e:
        print(f"Error registering user: {e}")
        return {'statusCode': 500, 'body': json.dumps({'status': 'error', 'message': 'Internal server error.'})}

def get_user_profile(chat_id):
    """
    Retrieves the user's profile from DynamoDB.
    """
    try:
        response = user_table.get_item(Key={'chat_id': chat_id})
        return response.get('Item')
    except Exception as e:
        print(f"Error getting user profile from DynamoDB: {e}")
        return None

def handle_new_user(chat_id):
    """
    Handles messages from new, unregistered users by sending them an account
    linking URL with the chat_id as the state parameter.
    """
    auth_url = (
        f"https://{COGNITO_DOMAIN}/oauth2/authorize?"
        f"client_id={urllib.parse.quote(COGNITO_CLIENT_ID)}&"
        f"response_type=code&"
        f"scope={urllib.parse.quote('openid profile email')}&"
        f"redirect_uri={urllib.parse.quote(ALEXA_REDIRECT_URI)}&"
        f"state={chat_id}"  # Pass chat_id as state
    )

    welcome_message = (
        "Welcome to EchoBridge! "
        "To get started, you need to link your Amazon account. "
        f"Please use the following link to sign in and authorize the skill:\n\n"
        f"[Link Your Account]({auth_url})"
    )
    send_telegram_message(chat_id, welcome_message)

def handle_registered_user(message, user_profile):
    """
    Handles messages from registered users.
    """
    if 'text' in message:
        handle_text_message(message, user_profile)
    elif 'voice' in message:
        handle_voice_message(message, user_profile)
    else:
        send_telegram_message(message['chat']['id'], "Sorry, I can only process text and voice messages.")

def handle_text_message(message, user_profile):
    """
    Processes a text message and forwards it to the Alexa Skill Backend.
    """
    text = message.get('text')
    chat_id = message['chat']['id']
    access_token = user_profile.get('access_token')

    if not text or not access_token:
        send_telegram_message(chat_id, "There was an error processing your request. Please try again.")
        return

    api_url = f"{ALEXA_SKILL_BACKEND_URL}/v1/message"
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "userAccessToken": access_token,
        "messageType": "TEXT",
        "payload": {
            "text": text
        }
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=10)
        if response.status_code == 202:
            send_telegram_message(chat_id, "✅ Your message has been sent to your Alexa devices.")
        else:
            print(f"Error calling skill backend: {response.status_code} {response.text}")
            send_telegram_message(chat_id, "❌ Sorry, there was a problem sending your message. Please try again later.")
    except requests.exceptions.Timeout:
        print("Timeout calling skill backend")
        send_telegram_message(chat_id, "⏱️ Request timed out. Please try again later.")
    except Exception as e:
        print(f"Exception calling skill backend: {e}")
        send_telegram_message(chat_id, "❌ Sorry, there was a problem sending your message. Please try again later.")

def handle_voice_message(message, user_profile):
    """
    Processes a voice message, transcodes it, and forwards it to the Alexa Skill Backend.
    """
    chat_id = message['chat']['id']
    file_id = message['voice']['file_id']
    access_token = user_profile.get('access_token')

    send_telegram_message(chat_id, "🎤 Processing your voice message...")

    try:
        # 1. Get file path from Telegram
        file_path = get_telegram_file_path(file_id)
        if not file_path:
            raise ValueError("Could not get file path from Telegram.")

        # 2. Download the .ogg file
        ogg_file_path = f"/tmp/{uuid.uuid4()}.ogg"
        download_file(file_path, ogg_file_path)

        # 3. Transcode to MP3
        mp3_file_path = f"/tmp/{uuid.uuid4()}.mp3"
        transcode_to_mp3(ogg_file_path, mp3_file_path)

        # 4. Upload to S3
        s3_object_key = f"voice-messages/{uuid.uuid4()}.mp3"
        upload_to_s3(mp3_file_path, s3_object_key)

        # 5. Generate pre-signed URL
        presigned_url = create_presigned_url(s3_object_key)

        # 6. Call Skill Backend
        api_url = f"{ALEXA_SKILL_BACKEND_URL}/v1/message"
        headers = {"x-api-key": API_KEY, "Content-Type": "application/json"}
        payload = {
            "userAccessToken": access_token,
            "messageType": "VOICE",
            "payload": {"audioUrl": presigned_url}
        }
        response = requests.post(api_url, headers=headers, json=payload, timeout=10)

        if response.status_code == 202:
            send_telegram_message(chat_id, "✅ Your voice message has been sent to your Alexa devices.")
        else:
            raise Exception(f"Skill backend returned error: {response.status_code}")

    except Exception as e:
        print(f"Error processing voice message: {e}")
        send_telegram_message(chat_id, "❌ Sorry, there was a problem processing your voice message. Please try again later.")
    finally:
        # Clean up temporary files
        if 'ogg_file_path' in locals() and os.path.exists(ogg_file_path):
            os.remove(ogg_file_path)
        if 'mp3_file_path' in locals() and os.path.exists(mp3_file_path):
            os.remove(mp3_file_path)


def get_telegram_file_path(file_id):
    """Gets the file path for a file_id from Telegram."""
    url = f"{TELEGRAM_API_URL}/getFile"
    params = {'file_id': file_id}
    response = requests.get(url, params=params)
    if response.status_code == 200:
        return response.json()['result']['file_path']
    return None

def download_file(file_path, dest_path):
    """Downloads a file from Telegram."""
    url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file_path}"
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with open(dest_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

def transcode_to_mp3(input_path, output_path):
    """Transcodes an audio file to MP3 using a bundled FFmpeg."""
    # Check if ffmpeg exists and is executable
    ffmpeg_path = './ffmpeg'
    if not os.path.exists(ffmpeg_path):
        # Fallback to system ffmpeg if bundled version doesn't exist
        ffmpeg_path = 'ffmpeg'

    command = [
        ffmpeg_path,
        '-i', input_path,
        '-acodec', 'libmp3lame',
        '-ab', '48k',
        '-ar', '24000',
        '-y',  # Overwrite output file if exists
        output_path
    ]
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        print(f"FFmpeg stdout: {result.stdout}")
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg error: {e.stderr}")
        raise
    except FileNotFoundError:
        raise Exception("FFmpeg binary not found. Please ensure ffmpeg is available in the deployment package.")

def upload_to_s3(file_path, object_key):
    """Uploads a file to the S3 bucket."""
    s3_client.upload_file(file_path, S3_BUCKET_NAME, object_key)

def create_presigned_url(object_key, expiration=300):
    """Generates a pre-signed URL for an S3 object."""
    return s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': S3_BUCKET_NAME, 'Key': object_key},
        ExpiresIn=expiration
    )

def send_telegram_message(chat_id, text):
    """
    Sends a text message to a user via the Telegram Bot API.
    """
    url = f"{TELEGRAM_API_URL}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'Markdown'
    }
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Error sending message to Telegram: {e}")
