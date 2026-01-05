FROM node:18-alpine

# Install FFmpeg
# Option 1: Install from Alpine repositories (easiest)
RUN apk add --no-cache ffmpeg

# Option 2: Copy static binary (if you prefer a specific version or minimal image)
# COPY --from=mwader/static-ffmpeg:6.0 /ffmpeg /usr/local/bin/
# COPY --from=mwader/static-ffmpeg:6.0 /ffprobe /usr/local/bin/

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
