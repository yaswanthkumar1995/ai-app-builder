# AI Code Platform - Setup Guide

This guide will help you set up and run the AI Code Platform microservices architecture.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for AI service development)
- Git

## Quick Start with Docker Compose

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-code-platform
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Start all services**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:8000
   - Database Service: http://localhost:3003
   - AI Service: http://localhost:8001

## Manual Setup (Development)

### 1. Database Setup
```bash
# Start MySQL and ChromaDB
docker-compose up mysql chromadb -d

# Run database migrations
cd services/database-service
npm install
npm run db:push
```

### 2. API Gateway Setup
```bash
cd services/api-gateway
npm install
npm run dev
```

### 3. Database Service Setup
```bash
cd services/database-service
npm install
npm run dev
```

### 4. AI Service Setup
```bash
cd services/ai-service
pip install -r requirements.txt
python main.py
```

### 5. Frontend Setup
```bash
cd services/frontend
npm install
npm start
```

## Configuration

### Environment Variables

Edit the `.env` file with your settings:

```env
# AI Provider API Keys (optional - can be set via UI)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_API_KEY=your_google_api_key

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=24h

# Database Configuration
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=ai_platform
MYSQL_USER=user
MYSQL_PASSWORD=password

# Service URLs
REACT_APP_API_GATEWAY_URL=http://localhost:8000
AUTH_SERVICE_URL=http://auth-service:3001
AI_SERVICE_URL=http://ai-service:8001
DATABASE_SERVICE_URL=http://database-service:3003
```

## First Time Setup

1. **Start the application** using Docker Compose
2. **Access the frontend** at http://localhost:3000
3. **Create an account** or login
4. **Configure AI providers** in Settings:
   - Go to Settings → AI Provider Settings
   - Enable desired providers (OpenAI, Anthropic, Google)
   - Enter your API keys for each provider
   - Save settings

## Testing the AI Integration

1. **Go to Chat** in the application
2. **Send a message** like "Hello, can you help me write a React component?"
3. **The system will**:
   - Check your provider settings
   - Use the first enabled provider with a valid API key
   - Stream the AI response back to you

## Troubleshooting

### Common Issues

1. **"No AI provider enabled" error**
   - Go to Settings and enable at least one AI provider
   - Make sure you have entered a valid API key

2. **Database connection errors**
   - Ensure MySQL container is running: `docker-compose ps`
   - Check database logs: `docker-compose logs mysql`

3. **AI service errors**
   - Check AI service logs: `docker-compose logs ai-service`
   - Verify API keys are correct in Settings

4. **Frontend not loading**
   - Check if all services are running
   - Clear browser cache
   - Check browser console for errors

### Service Health Checks

All services include health check endpoints:

- API Gateway: `GET /health`
- Database Service: `GET /health`
- AI Service: `GET /health`

### Logs

View service logs:
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs api-gateway
docker-compose logs database-service
docker-compose logs ai-service
docker-compose logs frontend
```

## Development Workflow

1. **Make changes** to any service
2. **Rebuild and restart** the service:
   ```bash
   docker-compose up --build <service-name>
   ```
3. **Check logs** for any errors
4. **Test the changes** in the frontend

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│   API Gateway   │
│   (React)       │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼─────┐
        │ AI Service   │ │Database     │ │ Auth      │
        │ (FastAPI)    │ │Service      │ │ Service   │
        └──────────────┘ └─────────────┘ └───────────┘
                │               │
        ┌───────▼──────┐ ┌──────▼──────┐
        │  ChromaDB    │ │   MySQL     │
        │ (Vector DB)  │ │  (RDBMS)    │
        └──────────────┘ └─────────────┘
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh JWT token

### Chat/AI
- `POST /api/chat` - Send chat message to AI
- `GET /api/providers` - List available AI providers

### Settings
- `GET /api/settings/providers` - Get user provider settings
- `POST /api/settings/providers` - Save user provider settings

### Projects
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

## Security Notes

- API keys are stored encrypted in the database
- JWT tokens are used for authentication
- CORS is configured for frontend access
- Rate limiting is implemented on API endpoints
- All services run in isolated containers

## Contributing

1. Follow the existing code structure
2. Add proper error handling
3. Include health checks for new services
4. Update documentation for API changes
5. Test thoroughly before committing

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review service logs for error messages
3. Ensure all environment variables are set correctly
4. Verify Docker containers are running properly
