#!/bin/bash
# start.sh - Script to setup and start the server

# Ensure necessary directories exist
mkdir -p games
mkdir -p emdata

# Sync S3 bucket to games directory
echo "Syncing S3 bucket to games directory..."
aws s3 sync s3://ccportedgames ./games/

# Clone/pull emdata repository
echo "Updating emdata repository..."
if [ -d "emdata" ] && [ -d "emdata/.git" ]; then
    cd emdata
    git pull https://github.com/ccported/emdata
    cd ..
else
    git clone https://github.com/ccported/emdata
fi

# Start the server
echo "Starting server with Bun..."
echo "Main server will run on port 3000"
echo "TomHTTP bare server will run on port 8080 at path /bare/"
bun run server.js
