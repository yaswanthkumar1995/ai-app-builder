# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./
COPY tailwind.config.js ./
COPY tsconfig.json ./

# Clear npm cache and configure npm for better reliability
RUN npm cache clean --force && \
    npm config set fetch-timeout 12000 && \
    npm config set fetch-retry-mintimeout 3000 && \
    npm config set fetch-retry-maxtimeout 18000 && \
    npm config set fetch-retries 5 && \
    npm config set registry https://registry.npmjs.org/

# Install dependencies - try npm ci first, fallback to npm install if needed
RUN npm ci --no-audit --no-fund --verbose || \
    (echo "npm ci failed, trying npm install instead..." && \
     rm -rf node_modules package-lock.json && \
     npm install --no-audit --no-fund --verbose)

# Copy source code
COPY public/ ./public/
COPY src/ ./src/

# Set environment variables for build
ARG REACT_APP_API_GATEWAY_URL
ARG REACT_APP_WS_URL
ENV REACT_APP_API_GATEWAY_URL=$REACT_APP_API_GATEWAY_URL
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL

# Build the application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy built application
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
