// 세이브 라우트: 계정당 1슬롯. GET=불러오기 / PUT=저장(upsert). 전체 Bearer 인증 필요.
import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth';
import { saves } from '../db';

export const saveRouter = Router();
saveRouter.use(requireAuth);

const SAVE_VERSION = 1; // 세이브 포맷 버전 (M2 가공·저장 들어오면 올려서 마이그레이션)

saveRouter.get('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId as string;
  const doc = await saves().findOne({ _id: userId });
  res.json({ v: SAVE_VERSION, state: doc?.state ?? null });
});

saveRouter.put('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId as string;
  const state = ((req.body ?? {}) as { state?: unknown }).state;
  if (state === null || typeof state !== 'object') {
    res.status(400).json({ error: 'state 누락 또는 형식 오류' });
    return;
  }
  await saves().updateOne(
    { _id: userId },
    { $set: { v: SAVE_VERSION, state, updatedAt: new Date() } },
    { upsert: true },
  );
  res.json({ ok: true });
});
