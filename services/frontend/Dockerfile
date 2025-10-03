# Stage 1: install dependencies with caching
FROM node:18-alpine AS deps

WORKDIR /app

RUN apk add --no-cache git

COPY package*.json ./

RUN npm config set fetch-timeout 300000 \
    && npm config set fetch-retry-mintimeout 60000 \
    && npm config set fetch-retry-maxtimeout 300000 \
    && npm config set fetch-retries 5 \
    && npm cache clean --force

RUN npm ci --no-audit --no-fund --verbose || \
    (echo "npm ci failed; falling back to npm install" && \
     rm -rf node_modules package-lock.json && \
     npm install --no-audit --no-fund --verbose)

# Stage 2: build application
FROM node:18-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY tailwind.config.js ./
COPY craco.config.js ./
COPY tsconfig.json ./
COPY public ./public
COPY src ./src

ARG REACT_APP_API_GATEWAY_URL
ARG REACT_APP_WS_URL
ENV REACT_APP_API_GATEWAY_URL=$REACT_APP_API_GATEWAY_URL
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL

RUN npm run build

# Stage 3: serve with nginx
FROM nginx:stable-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
