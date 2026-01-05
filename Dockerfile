FROM node:18-alpine

# Install FFmpeg for audio transcoding
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/index.js"]
