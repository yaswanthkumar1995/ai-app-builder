import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface AuthRequest extends Request {
  user?: any;
}

const sanitizeUsername = (value?: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const cleaned = trimmed.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
  return cleaned || undefined;
};

const buildFallbackUsername = (userId?: unknown): string => {
  const safeId = typeof userId === 'string' && userId
    ? userId.replace(/[^a-zA-Z0-9]/g, '').slice(-12)
    : undefined;

  if (safeId && safeId.length > 0) {
    return `user_${safeId}`;
  }

  const random = crypto.randomUUID().replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'anon';
  return `user_${random}`;
};

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;

    req.user = decoded;

    // Add user info to headers for downstream services when available
    if (decoded.id) {
      req.headers['x-user-id'] = String(decoded.id);
    } else {
      delete req.headers['x-user-id'];
    }

    if (decoded.email) {
      req.headers['x-user-email'] = String(decoded.email);
    } else {
      delete req.headers['x-user-email'];
    }

    const normalizedUsername = sanitizeUsername(decoded.username) || buildFallbackUsername(decoded.id);
    req.headers['x-username'] = normalizedUsername;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};
