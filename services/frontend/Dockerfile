# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tailwind.config.js ./
COPY tsconfig.json ./

# Install dependencies with retry logic and timeout
RUN npm config set fetch-timeout 60000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --no-audit --no-fund

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
