import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Errors } from '../utils/errors';
import type { IUser } from '../models/User';
import type { Types } from 'mongoose';

export interface AuthPayload {
  sub: string;
  email: string;
  type: 'access';
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: Types.ObjectId | string;
        email: string;
      };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token as string | undefined;

  if (!token) {
    next(Errors.unauthorized());
    return;
  }

  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as AuthPayload;

    if (payload.type !== 'access') {
      next(Errors.unauthorized('Invalid token type'));
      return;
    }

    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(Errors.unauthorized('Invalid or expired token'));
  }
}

export function signAccessToken(user: Pick<IUser, '_id' | 'email'>): string {
  const payload: AuthPayload = {
    sub: user._id.toString(),
    email: user.email,
    type: 'access',
  };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

export function verifyRefreshToken(token: string): { sub: string } {
  const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as {
    sub: string;
    type: string;
  };
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  return { sub: payload.sub };
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 min
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
