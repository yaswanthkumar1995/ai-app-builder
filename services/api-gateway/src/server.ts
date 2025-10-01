import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Server as SocketServer } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { setupWebSocket } from './websocket/socketHandler';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes (no auth middleware needed, no rate limiting)
app.use('/api/auth', (req, res, next) => {
  console.log('Auth request received:', req.method, req.url);
  next();
}, createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('Proxying request to:', proxyReq.getHeader('host'), proxyReq.path);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Proxy response:', proxyRes.statusCode);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
  }
}));

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email']
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for other API routes (excluding auth)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for auth routes
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  limiter(req, res, next);
});

// Protected routes - apply auth middleware (excluding auth routes)
app.use('/api', (req, res, next) => {
  // Skip auth middleware for auth routes
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  authMiddleware(req, res, next);
});

// Service routes
app.use('/api/chat', createProxyMiddleware({
  target: process.env.AI_SERVICE_URL || 'http://ai-service:8001',
  changeOrigin: true,
  pathRewrite: { '^/api/chat': '/chat' }
}));

app.use('/api/files', createProxyMiddleware({
  target: process.env.FILE_SERVICE_URL || 'http://file-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/files': '' }
}));

app.use('/api/projects', createProxyMiddleware({
  target: process.env.DATABASE_SERVICE_URL || 'http://database-service:3003',
  changeOrigin: true,
  pathRewrite: { '^/api/projects': '/projects' }
}));

// Direct settings route implementation (bypasses problematic proxy)
app.use('/api/settings', async (req: any, res: Response) => {
  console.log('🔥 Settings request received:', req.method, req.url, 'User:', req.user?.email);
  
  try {
    const databaseServiceUrl = process.env.DATABASE_SERVICE_URL || 'http://database-service:3003';
    const targetUrl = `${databaseServiceUrl}/settings${req.url.replace('/api/settings', '')}`;
    
    console.log('🚀 Direct request to:', targetUrl);
    console.log('📦 Request body:', req.body);
    
    // Make direct HTTP request to database service
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': req.user?.id || '',
        'x-user-email': req.user?.email || '',
        'authorization': req.headers.authorization || '',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    const data = await response.text();
    console.log('✅ Database service response:', response.status, data);
    
    // Forward response
    res.status(response.status);
    if (response.headers.get('content-type')?.includes('json')) {
      res.json(JSON.parse(data));
    } else {
      res.send(data);
    }
    
  } catch (error) {
    console.error('❌ Direct settings request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket setup
setupWebSocket(io);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
