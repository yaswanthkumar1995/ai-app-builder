# AI Code Platform - Microservices Architecture

A comprehensive AI-powered code generation platform combining the best features of Dyad and Bolt.diy in a scalable microservices architecture.

## Architecture Overview

### Services

1. **Frontend Service** (React + Tailwind CSS + TypeScript)
   - Modern web interface
   - Real-time chat interface
   - Code editor with syntax highlighting
   - Live preview capabilities
   - Project management dashboard

2. **API Gateway** (Node.js + Express)
   - Request routing and load balancing
   - Authentication middleware
   - Rate limiting and security
   - Service orchestration

3. **Auth Service** (Node.js + JWT)
   - User authentication and authorization
   - Session management
   - API key management
   - Role-based access control

4. **AI/Inference Service** (Python + FastAPI)
   - Multiple AI provider integration
   - Streaming response handling
   - Context management and optimization
   - Tool calling and function execution

5. **Database Service** (MySQL + ChromaDB)
   - User data and project storage
   - Vector embeddings for context search
   - Chat history and session management
   - File metadata and versioning

6. **File Service** (Node.js)
   - File upload/download management
   - Temporary file storage in /tmp
   - File versioning and backup
   - Project scaffolding and templates

## Features

### From Dyad
- Local development capabilities
- Advanced context management
- Multiple AI provider support
- File system operations
- Smart context selection
- XML-like response parsing

### From Bolt.diy
- Web-based interface
- Real-time streaming
- Live preview capabilities
- WebContainer integration
- Deployment features
- Modern UI/UX

### New Microservices Features
- Horizontal scalability
- Service isolation
- Independent deployments
- Load balancing
- Fault tolerance
- API-first architecture

## Getting Started

1. Clone the repository
2. Install dependencies for each service
3. Set up environment variables
4. Start services using Docker Compose
5. Access the application at http://localhost:3000

## Development

Each service can be developed and deployed independently. See individual service README files for specific setup instructions.

## Deployment

The platform supports deployment via Docker containers with orchestration through Docker Compose or Kubernetes.
