# Dockerfile for Node.js application
FROM node:18-alpine

# Add build argument for commit SHA
ARG COMMIT_SHA=unknown

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./
RUN npm install

# Bundle app source
COPY src .

# Create a file with the commit sha
RUN echo "${COMMIT_SHA}" > /usr/src/app/commit_sha.txt

# The app is a lambda function, so we don't need to start a server.
# We will just keep the container running.
CMD [ "tail", "-f", "/dev/null" ]
