import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@kaushalsetu/shared';
import { env } from './env';
import { HttpError } from './lib/http';

export interface AuthClaims {
  sub: string;
  role: Role;
  name: string;
  providerId?: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export function signToken(claims: AuthClaims, expiresIn: string | number = '12h'): string {
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

function readToken(req: Request): AuthClaims | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), env.JWT_SECRET) as AuthClaims;
  } catch {
    return null;
  }
}

// Token travels only in the Authorization header; there are no auth cookies.
export function requireAuth(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const claims = readToken(req);
    if (!claims) return next(new HttpError(401, 'Sign in again to continue.'));
    if (roles.length && !roles.includes(claims.role)) return next(new HttpError(403, 'Your role does not have access to this.'));
    req.auth = claims;
    next();
  };
}

export function auth(req: Request): AuthClaims {
  if (!req.auth) throw new HttpError(401, 'Sign in again to continue.');
  return req.auth;
}
