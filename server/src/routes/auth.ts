// 인증 라우트: 회원가입 / 로그인 / 아이디 중복 확인. /api/auth/* 전체에 rate-limit.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { hashPw, signToken, verifyPw } from '../auth';
import { users } from '../db';
import { validateId, validatePw } from '../validate';

export const authRouter = Router();

authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20, // IP당 15분 20회 — 무차별 대입 방어
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

// 로그인 실패는 아이디/비번 중 어느 쪽인지 구분하지 않음 (Obsidian: 계정 존재 여부 노출 방지)
const GENERIC = '아이디 또는 비밀번호가 일치하지 않습니다';

authRouter.post('/signup', async (req, res) => {
  const body = (req.body ?? {}) as { id?: unknown; pw?: unknown };
  const err = validateId(body.id) ?? validatePw(body.pw);
  if (err) {
    res.status(400).json({ ok: false, error: err });
    return;
  }
  const id = body.id as string;
  const pw = body.pw as string;
  if (await users().findOne({ _id: id })) {
    res.status(400).json({ ok: false, error: '중복아이디입니다' });
    return;
  }
  await users().insertOne({ _id: id, pwHash: await hashPw(pw), createdAt: new Date() });
  res.json({ ok: true });
});

authRouter.post('/login', async (req, res) => {
  const body = (req.body ?? {}) as { id?: unknown; pw?: unknown };
  if (typeof body.id !== 'string' || typeof body.pw !== 'string') {
    res.status(401).json({ error: GENERIC });
    return;
  }
  const user = await users().findOne({ _id: body.id });
  if (!user || !(await verifyPw(body.pw, user.pwHash))) {
    res.status(401).json({ error: GENERIC });
    return;
  }
  res.json({ token: signToken(body.id) });
});

authRouter.get('/id-taken', async (req, res) => {
  const id = req.query.id;
  if (typeof id !== 'string' || validateId(id) !== null) {
    res.json({ taken: false });
    return;
  }
  res.json({ taken: (await users().findOne({ _id: id })) !== null });
});
