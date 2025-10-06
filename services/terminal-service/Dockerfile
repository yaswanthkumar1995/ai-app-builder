# Multi-stage build for ARM64 compatibility
FROM --platform=linux/arm64 node:18-bullseye as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    make \
    g++ \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with rebuild for ARM64
RUN npm install --build-from-source

# Production stage
FROM --platform=linux/arm64 node:18-bullseye

# Install runtime dependencies
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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy source code
COPY server.js ./
COPY logger.js ./

# Expose port
EXPOSE 8001

# Start the service
CMD ["node", "server.js"]
