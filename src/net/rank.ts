// 랭킹 조회. 제출 없음 — 서버가 세이브 저장 시 자동 계산(server/src/rank.ts).
import { getToken } from '../auth/api';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type RankEntry = {
  rank: number;
  userId: string;
  seasonRevenue: number;
  war: number;
  scale: number;
};
export type SeasonRanking = { season: string; entries: RankEntry[] };
export type HallOfFameSeason = { seasonId: string; entries: RankEntry[] };
export type HallOfFame = { seasons: HallOfFameSeason[] };

async function authedGet<T>(path: string): Promise<T | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}${path}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export function getSeasonRanking(): Promise<SeasonRanking | null> {
  return authedGet<SeasonRanking>('/api/rank');
}

export function getHallOfFame(): Promise<HallOfFame | null> {
  return authedGet<HallOfFame>('/api/rank/hall-of-fame');
}
