// 세이브 라우트: 계정당 1슬롯. GET=불러오기 / PUT=저장(upsert). 전체 Bearer 인증 필요.
import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../auth';
import { saves } from '../db';
import { updateRankingForSave } from '../rank';

export const saveRouter = Router();
saveRouter.use(requireAuth);

// v5: SimState.totalRevenue 추가(M5 WAR/시즌 랭킹용). v1~v4 는 클라 normalizeState 가 흡수.
const SAVE_VERSION = 5;

saveRouter.get('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId as string;
  const doc = await saves().findOne({ _id: userId });
  res.json({ v: doc?.v ?? SAVE_VERSION, state: doc?.state ?? null });
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
  try {
    await updateRankingForSave(userId, state);
  } catch (e) {
    // 랭킹 갱신 실패가 세이브 자체를 실패시키면 안 됨 — 세이브는 이미 정상 처리됨
    console.error('랭킹 갱신 실패 (세이브는 정상 처리됨):', e);
  }
  res.json({ ok: true });
});
