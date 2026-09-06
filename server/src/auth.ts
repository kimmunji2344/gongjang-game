// 비밀번호 해시(bcrypt) + 로그인 토큰(JWT) + Bearer 인증 미들웨어.
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { requireEnv } from './env';

const SECRET = requireEnv('JWT_SECRET');
const TOKEN_TTL = '7d'; // Code.md 확정: 7일 만료, 갱신 없음

const BCRYPT_ROUNDS = 10;

export const hashPw = (pw: string): Promise<string> => bcrypt.hash(pw, BCRYPT_ROUNDS);
export const verifyPw = (pw: string, hash: string): Promise<boolean> => bcrypt.compare(pw, hash);
export const signToken = (id: string): string => jwt.sign({ id }, SECRET, { expiresIn: TOKEN_TTL });

export type AuthedRequest = Request & { userId?: string };

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, SECRET);
    const id = typeof payload === 'object' && payload !== null ? (payload as { id?: unknown }).id : undefined;
    if (typeof id !== 'string') throw new Error('토큰 payload 이상');
    (req as AuthedRequest).userId = id;
    next();
  } catch {
    res.status(401).json({ error: '인증이 필요합니다' });
  }
}
