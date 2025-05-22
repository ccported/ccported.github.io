FROM oven/bun:latest

# Install git and AWS CLI
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf awscliv2.zip aws

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
COPY bun.lockb ./
RUN bun install

# Copy server files
COPY server.js ./
COPY start.sh ./
RUN chmod +x start.sh

# Create directories for mounted volumes
RUN mkdir -p games emdata

# Copy build directory
COPY build ./build

# Expose ports
EXPOSE 3000
EXPOSE 8080

# Set the entrypoint
ENTRYPOINT ["./start.sh"]