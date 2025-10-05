import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import winston from 'winston';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { db } from './db';
import { users } from './db/schema';
import { eq, and, gt } from 'drizzle-orm';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
app.use(compression());
app.use(express.json());

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

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Helper functions
const generateToken = (user: any) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as jwt.SignOptions
  );
};

const hashPassword = async (password: string) => {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  return bcrypt.hash(password, saltRounds);
};

const verifyPassword = async (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};

// Email transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send verification email
const sendVerificationEmail = async (email: string, name: string, token: string) => {
  const transporter = createEmailTransporter();
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Verify Your AI Code Platform Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Welcome to AI Code Platform, ${name}!</h2>
        <p>Please verify your email address to complete your registration.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}"
             style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          This verification link will expire in 24 hours.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Routes
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    await db.insert(users).values({
      email,
      name,
      password: hashedPassword,
      verificationToken,
      verificationExpires,
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, name, verificationToken);
      logger.info(`Verification email sent to: ${email}`);
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
    }

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        email,
        name,
        isVerified: false
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }

    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult[0];

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in',
        requiresVerification: true
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password || '');
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

    logger.info(`User logged in: ${email}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }

    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;

    // Find user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new token
    const newToken = generateToken(userResult[0]);

    res.json({ token: newToken });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/auth/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;

    // Find user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: userResult[0].id,
        email: userResult[0].email,
        name: userResult[0].name,
      }
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    logger.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Email verification route
app.post('/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user with matching verification token
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    const user = userResult[0];

    // Check if token is expired
    if (user.verificationExpires && user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Update user as verified and clear verification fields
    await db
      .update(users)
      .set({
        isVerified: true,
        verificationToken: null,
        verificationExpires: null,
      })
      .where(eq(users.id, user.id));

    logger.info(`User verified email: ${user.email}`);

    res.json({
      message: 'Email verified successfully. You can now log in.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: true
      }
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend verification email route
app.post('/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult[0];

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new verification token
    await db
      .update(users)
      .set({
        verificationToken,
        verificationExpires,
      })
      .where(eq(users.id, user.id));

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
      logger.info(`Verification email resent to: ${user.email}`);
    } catch (emailError) {
      logger.error('Failed to resend verification email:', emailError);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.json({
      message: 'Verification email sent. Please check your email.'
    });
  } catch (error) {
    logger.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GitHub App / OAuth Configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME;
// Mode: 'app' (GitHub App installation flow) or 'oauth' (classic OAuth App)
const GITHUB_MODE = (process.env.GITHUB_MODE || 'app').toLowerCase();
const GITHUB_DEBUG = (process.env.GITHUB_DEBUG === '1' || process.env.GITHUB_DEBUG === 'true');
// Prefer api-gateway external callback if provided
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `${process.env.API_GATEWAY_PUBLIC_URL || 'http://localhost:8000'}/api/auth/github/callback`;

// Persist OAuth transient state across requests (simple in‑memory; replace with Redis in prod)
const githubAuthStates: Map<string, { userId: string; createdAt: number }> = new Map();

// Helpers to embed minimal user metadata into state (fallback if in-memory map lost)
const encodeUserId = (uid: string): string => {
  if (!uid) return '';
  return Buffer.from(uid, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
};
const decodeUserId = (fragment: string): string => {
  if (!fragment) return '';
  // Restore padding & translate URL-safe chars
  const b64 = fragment.replace(/-/g,'+').replace(/_/g,'/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  try {
    return Buffer.from(b64 + pad, 'base64').toString('utf8');
  } catch { return ''; }
};

// Generate JWT for GitHub App authentication
const generateJWT = async (): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const appId = process.env.GITHUB_APP_ID || GITHUB_CLIENT_ID;
  
  const payload = {
    iat: now - 60, // Issued 60 seconds ago
    exp: now + (10 * 60), // Expires in 10 minutes
    iss: appId // GitHub App ID
  };

  // Use private key if available, otherwise fallback to client secret
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  
  if (privateKey) {
    try {
      // Decode base64 private key if it's encoded
      const keyData = privateKey.includes('BEGIN') ? privateKey : Buffer.from(privateKey, 'base64').toString('utf-8');
      return jwt.sign(payload, keyData, { algorithm: 'RS256' });
    } catch (keyError) {
      logger.error('Failed to use private key, falling back to client secret:', keyError);
    }
  }

  // Fallback to client secret with HS256
  return jwt.sign(payload, GITHUB_CLIENT_SECRET || 'fallback', { algorithm: 'HS256' });
};

// Helper function to get user's installations
const getUserInstallations = async (userId: string): Promise<{
  hasInstallation: boolean;
  installationId?: string;
  accountLogin?: string;
}> => {
  try {
    // Get user's GitHub token from settings if they have one
    const settingsResp = await axios.get(
      `${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`,
      { headers: { 'x-user-id': userId } }
    );
    
    const githubSettings = settingsResp.data?.github;
    if (githubSettings?.apiKey && githubSettings?.installation_id) {
      return {
        hasInstallation: true,
        installationId: githubSettings.installation_id,
        accountLogin: githubSettings.account_login || ''
      };
    }
    
    return { hasInstallation: false };
  } catch (error) {
    logger.warn('Could not check for existing installations:', error);
    return { hasInstallation: false };
  }
};

// GitHub connect route (supports both modes)
app.get('/auth/github', async (req, res) => {
  try {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return res.status(500).json({ error: 'GitHub credentials not configured' });
    }

    const authHeader = req.headers.authorization;
    const tokenParam = req.query.token as string;
    let userId = '';
    const tokenToUse = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : tokenParam;

    if (tokenToUse) {
      try {
        const decoded = jwt.verify(tokenToUse, process.env.JWT_SECRET || 'default-secret') as any;
        userId = decoded.id;
        logger.info(`GitHub connect initiated for user: ${userId} (mode=${GITHUB_MODE})`);
      } catch {
        logger.info(`Invalid JWT supplied; proceeding anonymous (mode=${GITHUB_MODE})`);
      }
    } else {
      logger.info(`No JWT supplied; proceeding anonymous (mode=${GITHUB_MODE})`);
    }

    const randomPart = crypto.randomBytes(24).toString('hex');
    // Embed (optional) user id so if server restarts and state map is wiped we can still associate
    const state = userId ? `${randomPart}.${encodeUserId(userId)}` : randomPart;
    githubAuthStates.set(state, { userId, createdAt: Date.now() });

    let redirectUrl: string;
    if (GITHUB_MODE === 'app') {
      if (!GITHUB_APP_NAME) {
        return res.status(500).json({ error: 'GITHUB_APP_NAME missing for app mode' });
      }
      
      // Check for existing installation
      if (userId) {
        const existingInstallation = await getUserInstallations(userId);
        
        if (existingInstallation.hasInstallation && existingInstallation.installationId) {
          logger.info(`User ${userId} has existing installation ${existingInstallation.installationId}, refreshing installation`);
          // User already has an installation - refresh it and redirect to settings
          try {
            // Get fresh installation details
            const installResp = await axios.get(
              `https://api.github.com/app/installations/${existingInstallation.installationId}`,
              {
                headers: {
                  'Authorization': `Bearer ${await generateJWT()}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'User-Agent': 'AI-Code-Platform'
                }
              }
            );
            
            // Generate new access token
            const tokenResp = await axios.post(
              `https://api.github.com/app/installations/${existingInstallation.installationId}/access_tokens`,
              {},
              {
                headers: {
                  'Authorization': `Bearer ${await generateJWT()}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'User-Agent': 'AI-Code-Platform'
                }
              }
            );
            
            const accessToken = tokenResp.data.token;
            const accountInfo = {
              account_login: installResp.data.account?.login,
              account_name: installResp.data.account?.login,
              account_type: installResp.data.account?.type
            };
            
            // Update settings with refreshed token
            await axios.post(
              `${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`,
              {
                github: {
                  apiKey: accessToken,
                  enabled: true,
                  installation_id: existingInstallation.installationId,
                  setup_action: 'update',
                  app_type: 'github_app',
                  ...accountInfo
                }
              },
              { headers: { 'x-user-id': userId, 'Content-Type': 'application/json' } }
            );
            
            logger.info(`User ${userId} installation refreshed successfully`);
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?github_auth=success&reconnected=true`);
          } catch (refreshError: any) {
            logger.error('Failed to refresh existing installation:', refreshError?.response?.data || refreshError?.message);
            // Fall through to normal installation flow
          }
        }
        
        // New installation flow or fallback if refresh failed
        logger.info(`User ${userId} needs new installation, showing installation page`);
        redirectUrl = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new?state=${state}`;
      } else {
        // Anonymous/new user - show new installation page
        redirectUrl = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new?state=${state}`;
      }
    } else {
      // Classic OAuth flow
      const scopes = 'read:user user:email repo';
      // Add prompt=consent to force re-authorization screen
      redirectUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&state=${state}&prompt=consent`;
    }

    logger.info(`Redirecting user (${userId || 'anon'}) to GitHub (${GITHUB_MODE}) -> ${redirectUrl}`);
    res.redirect(redirectUrl);
  } catch (e) {
    logger.error('GitHub connect init error:', e);
    res.status(500).json({ error: 'Failed to start GitHub connection' });
  }
});

// GitHub App installation callback (like Cursor)
app.get(['/github/callback','/callback'], async (req, res) => {
  try {
    const installation_id = req.query.installation_id as string | undefined;
    const setup_action = req.query.setup_action as string | undefined;
    const state = req.query.state as string | undefined;
    const code = req.query.code as string | undefined;

    logger.info('GitHub callback received', { query: req.query, mode: GITHUB_MODE });

    // Helper: fetch & validate state if present
    const getStateData = () => {
      if (!state) return { userId: '', createdAt: 0 };
      const direct = githubAuthStates.get(state);
      if (direct) {
        if (Date.now() - direct.createdAt > 10 * 60 * 1000) {
          logger.warn('State expired – proceeding but accepting (direct map)');
        }
        return direct;
      }
      // Fallback: attempt to recover embedded user id (format random[.b64userid])
      if (state.includes('.')) {
        const parts = state.split('.');
        if (parts.length === 2) {
          const recovered = decodeUserId(parts[1]);
          if (recovered) {
            logger.warn('State map miss; recovered user id from embedded fragment');
            return { userId: recovered, createdAt: 0 };
          }
        }
      }
      logger.warn('State not found & no recoverable user id – proceeding anonymous');
      return { userId: '', createdAt: 0 };
    };

    // GitHub App installation flow (installation_id present)
    if (installation_id) {
      const s = getStateData();
      let accessToken = '';
      let accountInfo: any = {};
      
      try {
        const tokenResp = await axios.post(`https://api.github.com/app/installations/${installation_id}/access_tokens`, {}, {
          headers: {
            'Authorization': `Bearer ${await generateJWT()}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Code-Platform'
          }
        });
        accessToken = tokenResp.data.token;
        
        // Fetch installation/account details
        try {
          const installResp = await axios.get(`https://api.github.com/app/installations/${installation_id}`, {
            headers: {
              'Authorization': `Bearer ${await generateJWT()}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'AI-Code-Platform'
            }
          });
          accountInfo = {
            account_login: installResp.data.account?.login,
            account_name: installResp.data.account?.login,
            account_type: installResp.data.account?.type
          };
        } catch (accountErr) {
          logger.warn('Failed to fetch installation account details', accountErr);
        }
      } catch (err) {
        logger.error('Failed to create installation access token – storing installation id only', (err as any)?.response?.data || (err as any)?.message);
        accessToken = installation_id; // fallback; will be exchanged later on demand
      }

      // Patch: If userId is missing, try to recover from JWT in query or headers
      let userId = s.userId;
      if (!userId) {
        // Try JWT from query
        const jwtToken = req.query.token as string | undefined;
        if (jwtToken) {
          try {
            const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET || 'default-secret') as any;
            userId = decoded.id;
          } catch {}
        }
        // Try JWT from Authorization header
        if (!userId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
          try {
            const decoded = jwt.verify(req.headers.authorization.substring(7), process.env.JWT_SECRET || 'default-secret') as any;
            userId = decoded.id;
          } catch {}
        }
      }

      if (!userId) {
        logger.error('GitHub App callback: Could not determine userId, skipping provider settings update');
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?error=github_callback_missing_user`);
      }

      await axios.post(`${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`, {
        github: {
          apiKey: accessToken,
          enabled: true,
          installation_id,
          setup_action,
          app_type: 'github_app',
          ...accountInfo
        }
      }, { headers: { 'x-user-id': userId, 'Content-Type': 'application/json' } });

      if (state) githubAuthStates.delete(state);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?github_auth=success`);
    }

    // OAuth flow (explicit or fallback when code is present)
    if (code) {
      const s = getStateData();
      try {
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI,
          state
        }, { headers: { 'Accept': 'application/json', 'User-Agent': 'AI-Code-Platform' } });

        const { access_token, error: ghError, error_description } = tokenResponse.data;
        if (ghError || !access_token) {
          logger.error('OAuth exchange failed', tokenResponse.data);
          return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?error=oauth_exchange_failed&gh_error=${encodeURIComponent(ghError || 'none')}` + (error_description ? `&desc=${encodeURIComponent(error_description)}` : ''));
        }

        await axios.post(`${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`, {
          github: { apiKey: access_token, enabled: true, app_type: 'oauth_app' }
        }, { headers: { 'x-user-id': s.userId, 'Content-Type': 'application/json' } });

        if (state) githubAuthStates.delete(state);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?github_auth=success`);
      } catch (oauthErr: any) {
        logger.error('OAuth code exchange threw error', {
          message: oauthErr.message,
          responseStatus: oauthErr.response?.status,
          responseData: oauthErr.response?.data
        });
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?error=github_callback_error&stage=oauth_exchange&status=${oauthErr.response?.status || 'na'}`);
      }
    }

    // Nothing usable supplied – surface detailed debug info
    logger.error('GitHub callback missing expected parameters', { query: req.query });
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?error=github_missing_params`);
  } catch (error) {
    logger.error('GitHub callback error:', error);
    res.status(500).redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?error=github_callback_error`);
  }
});

// Debug endpoint (secured via env toggle) to inspect stored state (DO NOT enable in prod without protection)
if (GITHUB_DEBUG) {
  app.get('/auth/github/debug-state', (req, res) => {
    const state = req.query.state as string | undefined;
    if (state) {
      return res.json({ state, data: githubAuthStates.get(state) || null });
    }
    res.json({ size: githubAuthStates.size });
  });
}
// (Old callback tail removed by refactor above – duplicate code cleaned)

// GitHub disconnect route
app.post('/auth/github/disconnect', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;

    // Remove GitHub token from user's provider settings
    await axios.post(`${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`, {
      github: {
        apiKey: '',
        enabled: false,
        installation_id: '',
        app_type: ''
      }
    }, {
      headers: {
        'x-user-id': decoded.id,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`GitHub disconnected for user: ${decoded.id}`);

    res.json({ message: 'GitHub account disconnected successfully' });

  } catch (error) {
    logger.error('GitHub disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect GitHub account' });
  }
});

// Manual reconnection endpoint for existing installations
app.post('/auth/github/reconnect', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    const userId = decoded.id;

    logger.info(`Manual reconnection requested for user: ${userId}`);

    // Get user's existing installations from GitHub
    const jwt_token = await generateJWT();
    
    // First, get all installations for the app
    const installationsResp = await axios.get('https://api.github.com/app/installations', {
      headers: {
        'Authorization': `Bearer ${jwt_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Platform'
      }
    });

    logger.info(`Found ${installationsResp.data.length} total installations`);

    // Get current user's GitHub settings to see if they have a stored installation
    let existingInstallationId: string | null = null;
    let storedAccountLogin: string | null = null;
    
    try {
      const settingsResp = await axios.get(
        `${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`,
        { headers: { 'x-user-id': userId } }
      );
      existingInstallationId = settingsResp.data?.github?.installation_id || null;
      storedAccountLogin = settingsResp.data?.github?.account_login || null;
      logger.info(`User has existing installation_id in DB: ${existingInstallationId}, account: ${storedAccountLogin}`);
    } catch (err) {
      logger.warn('Could not fetch existing installation_id from DB', err);
    }

    // If no stored installation_id, try to find it by looking at all installations
    // This handles the case where user disconnected the app but installation still exists on GitHub
    if (!existingInstallationId && installationsResp.data.length > 0) {
      logger.info('No stored installation_id, searching GitHub installations...');
      
      // Try each installation to see which one matches this user  
      // Use installation account info directly (no need to call /user)
      for (const installation of installationsResp.data) {
        const accountLogin = installation.account?.login;
        
        if (!accountLogin) {
          logger.warn(`Installation ${installation.id} has no account info, skipping`);
          continue;
        }
        
        // Check if this matches the stored account or if it's the only installation
        if (storedAccountLogin && accountLogin === storedAccountLogin) {
          logger.info(`Found matching installation ${installation.id} for account ${accountLogin}`);
          existingInstallationId = installation.id.toString();
          break;
        } else if (!storedAccountLogin && installationsResp.data.length === 1) {
          // Only one installation and no stored account - assume it's this user
          logger.info(`Found single installation ${installation.id}, assuming it's for this user (account: ${accountLogin})`);
          existingInstallationId = installation.id.toString();
          break;
        }
      }
    }

    // If user has a stored or found installation, try to use it
    if (existingInstallationId) {
      try {
        logger.info(`Attempting to reconnect existing installation: ${existingInstallationId}`);
        
        // Get installation details
        const installResp = await axios.get(
          `https://api.github.com/app/installations/${existingInstallationId}`,
          {
            headers: {
              'Authorization': `Bearer ${jwt_token}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'AI-Code-Platform'
            }
          }
        );
        
        // Generate new access token
        const tokenResp = await axios.post(
          `https://api.github.com/app/installations/${existingInstallationId}/access_tokens`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${jwt_token}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'AI-Code-Platform'
            }
          }
        );
        
        const accessToken = tokenResp.data.token;
        const accountInfo = {
          account_login: installResp.data.account?.login,
          account_name: installResp.data.account?.login,
          account_type: installResp.data.account?.type
        };
        
        // Update settings with refreshed token
        await axios.post(
          `${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`,
          {
            github: {
              apiKey: accessToken,
              enabled: true,
              installation_id: existingInstallationId,
              setup_action: 'update',
              app_type: 'github_app',
              ...accountInfo
            }
          },
          { headers: { 'x-user-id': userId, 'Content-Type': 'application/json' } }
        );
        
        logger.info(`Successfully reconnected installation ${existingInstallationId} for user ${userId}`);
        return res.json({
          success: true,
          message: 'GitHub reconnected successfully',
          installation_id: existingInstallationId,
          account: accountInfo
        });
      } catch (refreshError: any) {
        logger.error('Failed to reconnect existing installation:', refreshError?.response?.data || refreshError?.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to reconnect existing installation. Please try disconnecting and reconnecting.',
          details: refreshError?.response?.data || refreshError?.message
        });
      }
    }

    // No existing installation found
    return res.status(404).json({
      success: false,
      error: 'No existing GitHub installation found. Please connect GitHub first.',
      installation_id: null
    });

  } catch (error: any) {
    logger.error('GitHub reconnect error:', error?.response?.data || error?.message);
    res.status(500).json({
      success: false,
      error: 'Failed to reconnect GitHub',
      details: error?.response?.data || error?.message
    });
  }
});

// Check GitHub App connection status
app.get('/auth/github/status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;

    // Get GitHub settings
    const settingsResp = await axios.get(`${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`, {
      headers: { 'x-user-id': decoded.id }
    });
    
    const githubSettings = settingsResp.data?.github || {};
    const isConnected = githubSettings.enabled && githubSettings.apiKey;
    const appType = githubSettings.app_type || 'unknown';
    const installationId = githubSettings.installation_id;

    if (!isConnected) {
      return res.json({
        connected: false,
        app_type: null,
        installation_id: null,
        user: null
      });
    }

    // Test the connection by making a simple API call
    try {
      let accessToken = githubSettings.apiKey;
      
      // For GitHub App, always generate fresh token
      if (appType === 'github_app' && installationId) {
        logger.info('Generating fresh installation access token for status check', { installationId });
        const tokenResponse = await axios.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
          headers: {
            'Authorization': `Bearer ${await generateJWT()}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Code-Platform'
          }
        });
        accessToken = tokenResponse.data.token;
      }

      const userResp = await axios.get('https://api.github.com/user', {
        headers: { 
          Authorization: `token ${accessToken}`, 
          'User-Agent': 'AI-Code-Platform' 
        }
      });

      res.json({
        connected: true,
        app_type: appType,
        installation_id: installationId,
        user: {
          login: userResp.data.login,
          name: userResp.data.name,
          avatar_url: userResp.data.avatar_url
        }
      });

    } catch (apiError) {
      logger.error('GitHub API test failed:', apiError);
      res.json({
        connected: false,
        app_type: appType,
        installation_id: installationId,
        error: 'Connection test failed - token may be expired'
      });
    }

  } catch (error) {
    logger.error('GitHub status check error:', error);
    res.status(500).json({ error: 'Failed to check GitHub status' });
  }
});

// List user repositories using stored GitHub token (OAuth or App installation)
app.get('/auth/github/repos', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      logger.error('List repos error: No authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const jwtToken = authHeader.substring(7);
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET || 'default-secret') as any;
    
    if (!decoded || !decoded.id) {
      logger.error('List repos error: Unauthorized - No user ID', { decoded });
      return res.status(401).json({ error: 'Unauthorized - No user ID' });
    }

    logger.info('Fetching repos for user', { userId: decoded.id, email: decoded.email });

    // Fetch provider settings to get token
    const settingsResp = await axios.get(`${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`, {
      headers: { 'x-user-id': decoded.id }
    });
    const githubSettings = settingsResp.data?.github || {};
    const githubToken = githubSettings.apiKey || '';
    const appType = githubSettings.app_type || 'oauth_app';
    const installationId = githubSettings.installation_id;

    logger.info('GitHub settings retrieved', { hasToken: !!githubToken, appType, githubSettings });

    if (!githubToken) {
      logger.error('List repos error: GitHub not connected');
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    let repos = [];
    
    if (appType === 'github_app' && installationId) {
      // For GitHub App, always generate a fresh installation access token
      try {
        logger.info('Generating fresh installation access token', { installationId });
        
        const tokenResponse = await axios.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
          headers: {
            'Authorization': `Bearer ${await generateJWT()}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Code-Platform'
          }
        });
        const accessToken = tokenResponse.data.token;
        
        logger.info('Successfully generated fresh installation access token');

        const ghResp = await axios.get(`https://api.github.com/installation/repositories?per_page=100`, {
          headers: { 
            Authorization: `token ${accessToken}`, 
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Code-Platform' 
          }
        });
        
        repos = ghResp.data.repositories.map((r: any) => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          private: r.private,
          defaultBranch: r.default_branch,
          cloneUrl: r.clone_url,
          sshUrl: r.ssh_url,
          updatedAt: r.updated_at
        }));
        
        logger.info(`Successfully fetched ${repos.length} repositories`);
      } catch (appError: any) {
        logger.error('GitHub App repos error:', appError?.response?.data || appError?.message);
        throw appError; // Re-throw to be caught by outer catch block
      }
    } else {
      // For OAuth App, list user repositories
      const ghResp = await axios.get('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: { Authorization: `token ${githubToken}`, 'User-Agent': 'AI-Code-Platform' }
      });
      repos = ghResp.data.map((r: any) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
        cloneUrl: r.clone_url,
        sshUrl: r.ssh_url,
        updatedAt: r.updated_at
      }));
    }

    res.json({ repos });
  } catch (e:any) {
    logger.error('List repos error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to list repositories' });
  }
});

// List branches for repo
app.get('/auth/github/branches', async (req, res) => {
  try {
    const { repo } = req.query; // expects full name owner/repo
    logger.info('Fetching branches for repo:', { repo });
    
    if (!repo || typeof repo !== 'string') {
      logger.error('List branches error: Missing or invalid repo parameter');
      return res.status(400).json({ error: 'repo query param required (owner/repo)' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      logger.error('List branches error: No authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const jwtToken = authHeader.substring(7);
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET || 'default-secret') as any;
    
    if (!decoded || !decoded.id) {
      logger.error('List branches error: Invalid JWT token');
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    logger.info('Fetching GitHub settings for branches', { userId: decoded.id, repo });
    
    const settingsResp = await axios.get(`${process.env.DATABASE_SERVICE_URL || 'http://database-service:3003'}/settings/providers`, {
      headers: { 'x-user-id': decoded.id }
    });
    const githubSettings = settingsResp.data?.github || {};
    const githubToken = githubSettings.apiKey || '';
    const appType = githubSettings.app_type || 'oauth_app';
    const installationId = githubSettings.installation_id;
    
    logger.info('GitHub settings for branches', { hasToken: !!githubToken, appType, repo });
    
    if (!githubToken) {
      logger.error('List branches error: GitHub not connected');
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    // For GitHub App, always generate fresh installation access token
    let accessToken = githubToken;
    if (appType === 'github_app' && installationId) {
      try {
        logger.info('Generating fresh installation access token for branches', { installationId });
        const tokenResponse = await axios.post(`https://api.github.com/app/installations/${installationId}/access_tokens`, {}, {
          headers: {
            'Authorization': `Bearer ${await generateJWT()}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Code-Platform'
          }
        });
        accessToken = tokenResponse.data.token;
        logger.info('Successfully generated fresh token for branches');
      } catch (tokenError: any) {
        logger.error('Failed to refresh GitHub App token:', tokenError?.response?.data || tokenError?.message);
        throw tokenError;
      }
    }

    logger.info('Fetching branches from GitHub API', { repo, url: `https://api.github.com/repos/${repo}/branches` });
    
    const ghResp = await axios.get(`https://api.github.com/repos/${repo}/branches?per_page=200`, {
      headers: { 
        Authorization: `token ${accessToken}`, 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Platform' 
      }
    });
    
    const branches = ghResp.data.map((b: any) => ({ name: b.name, protected: b.protected }));
    logger.info('Successfully fetched branches', { repo, count: branches.length });
    res.json({ branches });
  } catch (e:any) {
    logger.error('List branches error:', { 
      repo: req.query.repo,
      error: e.response?.data || e.message,
      status: e.response?.status,
      statusText: e.response?.statusText
    });
    res.status(500).json({ error: 'Failed to list branches' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString()
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
  logger.info(`Auth Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
