import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import winston from 'winston';
import { logger } from './utils/logger';
import settingsRoutes from './routes/settings';
import terminalSessionsRoutes from './routes/terminal-sessions';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
app.use(compression());
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    logger.info('Received body size', { bytes: buf.length });
  }
}));
app.use(express.urlencoded({ extended: true }));

// Add timeout middleware
app.use((req, res, next) => {
  // Set server timeout to 30 seconds
  req.setTimeout(30000, () => {
    logger.error('Request timeout', { method: req.method, url: req.url });
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  
  res.setTimeout(30000, () => {
    logger.error('Response timeout', { method: req.method, url: req.url });
    if (!res.headersSent) {
      res.status(408).json({ error: 'Response timeout' });
    }
  });
  
  next();
});

// Logger imported from utils

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

// Middleware to extract user from JWT (this will be validated by API Gateway)
app.use((req, res, next) => {
  try {
    // Trust the API Gateway has validated the JWT and extract user info from headers
    const userId = req.headers['x-user-id'] as string;
    const userEmail = req.headers['x-user-email'] as string;

    logger.info('Middleware - Headers received', {
      'x-user-id': userId,
      'x-user-email': userEmail,
      'authorization': req.headers.authorization ? 'present' : 'missing'
    });

    if (userId && userEmail) {
      req.user = { id: userId, email: userEmail };
      logger.info('Middleware - User set', { user: req.user });
    } else {
      logger.info('Middleware - No user info found in headers');
    }
  } catch (error) {
    logger.error('Middleware - Failed to extract user from request', { error: error instanceof Error ? error.message : String(error) });
  }
  next();
});

// Routes
app.use('/settings', settingsRoutes);
app.use('/terminal-sessions', terminalSessionsRoutes);

// Test endpoint
app.post('/test-auth', (req: any, res) => {
  logger.info('Test auth endpoint hit');
  logger.info('Headers', {
    authorization: req.headers.authorization,
    'x-user-id': req.headers['x-user-id'],
    'x-user-email': req.headers['x-user-email']
  });
  logger.info('User', { user: req.user });
  res.json({ 
    message: 'Test successful',
    user: req.user,
    headers: {
      'x-user-id': req.headers['x-user-id'],
      'x-user-email': req.headers['x-user-email']
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'database-service'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle request aborted errors specifically
  if (error.message === 'request aborted' || error.code === 'ECONNABORTED') {
    logger.warn('Request aborted', { method: req.method, url: req.url });
    // Don't try to send response as connection is already closed
    return;
  }

  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Check if response is already sent
  if (!res.headersSent) {
    res.status(error.statusCode || 500).json({
      error: error.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

app.listen(PORT, () => {
  logger.info(`Database Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
