FROM node:18-slim

# Install essential system tools and utilities
FROM node:18-bullseye

# Install system dependencies including bash-completion, development tools, and build essentials
RUN apt-get update && apt-get install -y \
    bash-completion \
    procps \
    coreutils \
    util-linux \
    git \
    vim \
    nano \
    tree \
    htop \
    curl \
    wget \
    sudo \
    python3 \
    python3-pip \
    build-essential \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with verbose logging
RUN npm install --verbose

# Copy source code
COPY . .

# Expose port
EXPOSE 3004

# Start the service
CMD ["npm", "start"]
