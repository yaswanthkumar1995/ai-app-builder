import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import winston from 'winston';
import settingsRoutes from './routes/settings';

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
  ]
});

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

    console.log('Middleware - Headers received:', {
      'x-user-id': userId,
      'x-user-email': userEmail,
      'authorization': req.headers.authorization ? 'present' : 'missing'
    });

    if (userId && userEmail) {
      req.user = { id: userId, email: userEmail };
      console.log('Middleware - User set:', req.user);
    } else {
      console.log('Middleware - No user info found in headers');
    }
  } catch (error) {
    console.error('Middleware - Failed to extract user from request:', error);
  }
  next();
});

// Routes
app.use('/settings', settingsRoutes);

// Test endpoint
app.post('/test-auth', (req: any, res) => {
  console.log('Test auth endpoint hit');
  console.log('Headers:', {
    authorization: req.headers.authorization,
    'x-user-id': req.headers['x-user-id'],
    'x-user-email': req.headers['x-user-email']
  });
  console.log('User:', req.user);
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
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(error.statusCode || 500).json({
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

app.listen(PORT, () => {
  logger.info(`Database Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
