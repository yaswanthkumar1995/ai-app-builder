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
import nodemailer from 'nodemailer';
import { body, validationResult } from 'express-validator';

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

// Terminal Service routes - MUST be before other middleware to avoid conflicts
app.use('/terminal', (req, res, next) => {
  logger.info('🔥 Terminal request received', { method: req.method, url: req.url });
  next();
}, createProxyMiddleware({
  target: 'http://terminal-service:3004',
  changeOrigin: true,
  logLevel: 'debug',
  timeout: 60000, // 60 second timeout for terminal operations
  proxyTimeout: 60000,
  onProxyReq: (proxyReq, req, res) => {
    logger.info('🚀 Proxying terminal request', { host: proxyReq.getHeader('host'), path: proxyReq.path });
    // Set longer timeout on the socket
    if (proxyReq.socket) {
      proxyReq.socket.setTimeout(60000);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    logger.info('✅ Terminal proxy response', { statusCode: proxyRes.statusCode });
  },
  onError: (err, req, res) => {
    logger.error('❌ Terminal proxy error', { error: err.message, stack: err.stack });
  }
}));

// Auth routes (no auth middleware needed, no rate limiting)
// Updated to maintain consistent routing with auth-service
app.use('/api/auth', (req, res, next) => {
  logger.info('Auth request received', { method: req.method, url: req.url });
  next();
}, createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  changeOrigin: true,
  pathRewrite: {
    // pathRewrite receives the full path /api/auth/*, not the stripped path
    // Replace /api with /auth to get /auth/auth/*, then simplify to /auth/*
    '^/api/auth': '/auth'
  },
  onProxyReq: (proxyReq, req, res) => {
    logger.info('Proxying auth request', { host: proxyReq.getHeader('host'), path: proxyReq.path });
  },
  onProxyRes: (proxyRes, req, res) => {
    logger.info('Auth proxy response', { statusCode: proxyRes.statusCode });
  },
  onError: (err, req, res) => {
    logger.error('Auth proxy error', { error: err.message, stack: err.stack });
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
  // Skip auth middleware for public routes
  if (req.path.startsWith('/auth') || req.path === '/contact') {
    return next();
  }
  // Apply auth middleware to all other routes
  authMiddleware(req, res, next);
});

const createEmailTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!user || !pass) {
    throw new Error('SMTP credentials are not configured');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
};

const contactValidationRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email address is required'),
  body('subject').trim().isLength({ min: 2 }).withMessage('Subject is required'),
  body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters'),
  body('phone').optional().trim().isLength({ min: 7, max: 32 }).withMessage('Phone number must be between 7 and 32 characters')
];

app.post('/api/contact', contactValidationRules, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, subject, message, phone } = req.body as {
    name: string;
    email: string;
    subject: string;
    message: string;
    phone?: string;
  };

  const recipient = process.env.CONTACT_RECIPIENT_EMAIL || 'yaramyaswanthkumar@gmail.com';
  const sender = process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER;

  if (!sender) {
    logger.error('Contact form sender email is not configured');
    return res.status(500).json({ error: 'Email configuration is incomplete' });
  }

  const formattedPhone = phone?.trim() ? `<p><strong>Phone:</strong> ${phone.trim()}</p>` : '';

  const htmlContent = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="color: #4338ca;">New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${formattedPhone}
      <p><strong>Subject:</strong> ${subject}</p>
      <p style="margin-top: 16px; white-space: pre-line;">${message}</p>
    </div>
  `;

  try {
    const transporter = createEmailTransporter();
    await transporter.sendMail({
      from: sender,
      to: recipient,
      replyTo: email,
      subject: `[AI Code Platform] ${subject}`,
      html: htmlContent
    });

    logger.info('Contact form email sent', { email, subject });

    return res.status(200).json({ message: 'Message sent successfully' });
  } catch (error) {
    logger.error('Failed to send contact form email', error as Error);
    return res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
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

// Terminal session routes
app.use('/api/terminal-sessions', createProxyMiddleware({
  target: process.env.DATABASE_SERVICE_URL || 'http://database-service:3003',
  changeOrigin: true,
  pathRewrite: { '^/api/terminal-sessions': '/terminal-sessions' }
}));



// Real Terminal Service routes
app.use('/api/terminal', createProxyMiddleware({
  target: 'http://terminal-service:3004',
  changeOrigin: true,
  pathRewrite: { '^/api/terminal': '/terminal' },
  timeout: 60000,
  proxyTimeout: 60000
}));

// Git operations integrated with terminal service
app.use('/api/git', createProxyMiddleware({
  target: 'http://terminal-service:3004',
  changeOrigin: true,
  pathRewrite: { '^/api/git': '/git' },
  timeout: 120000, // 2 minute timeout for git clone operations
  proxyTimeout: 120000,
  onProxyReq: (proxyReq, req) => {
    // Re-serialize JSON bodies that were parsed by Express before proxying
    if (!req.body || Object.keys(req.body).length === 0) {
      return;
    }

    const bodyData = JSON.stringify(req.body);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
}));

// Workspace state management
app.use('/api/workspace', createProxyMiddleware({
  target: 'http://terminal-service:3004',
  changeOrigin: true,
  pathRewrite: { '^/api/workspace': '/workspace' },
  timeout: 30000,
  proxyTimeout: 30000
}));

// AI-driven git operations
app.use('/api/ai/git', createProxyMiddleware({
  target: process.env.AI_SERVICE_URL || 'http://ai-service:8001',
  changeOrigin: true,
  pathRewrite: { '^/api/ai/git': '/git' }
}));

// Direct settings route implementation (bypasses problematic proxy)
app.use('/api/settings', async (req: any, res: Response) => {
  logger.info('🔥 Settings request received', { 
    method: req.method, 
    url: req.url, 
    user: req.user?.email 
  });
  
  try {
    const databaseServiceUrl = process.env.DATABASE_SERVICE_URL || 'http://database-service:3003';
    const targetUrl = `${databaseServiceUrl}/settings${req.url.replace('/api/settings', '')}`;
    
    logger.info('🚀 Direct request to target', { targetUrl });
    logger.debug('📦 Request body', { body: req.body });
    
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
    logger.info('✅ Database service response', { 
      status: response.status, 
      dataLength: data.length 
    });
    
    // Forward response
    res.status(response.status);
    if (response.headers.get('content-type')?.includes('json')) {
      res.json(JSON.parse(data));
    } else {
      res.send(data);
    }
    
  } catch (error) {
    logger.error('❌ Direct settings request error', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
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
