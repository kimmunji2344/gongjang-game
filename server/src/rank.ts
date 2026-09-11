// 랭킹 계산 — 클라 제출 없음. PUT /api/save 성공 시 서버가 저장된 SimState 로부터 직접 계산한다(위조 어려움).
import { SERVER_CONFIG } from './config';
import { rankings, type RankingDoc } from './db';
import { currentSeasonId } from './season';
import { computeWar } from './war';

// SimState 는 클라 타입이라 서버에 import 하지 않고, 필요한 필드만 얕게 읽는다.
type SavedState = {
  totalRevenue?: unknown;
  placeables?: unknown;
  gold?: unknown;
  tick?: unknown;
};

export async function updateRankingForSave(userId: string, state: unknown): Promise<void> {
  const s = (state ?? {}) as SavedState;
  const totalRevenue = typeof s.totalRevenue === 'number' ? s.totalRevenue : 0;
  const scale = Array.isArray(s.placeables) ? s.placeables.length : 0;
  const totalAssets = typeof s.gold === 'number' ? s.gold : 0;
  const tick = typeof s.tick === 'number' ? s.tick : 0;
  const seconds = tick / SERVER_CONFIG.tickHz;
  const efficiency = seconds > 0 ? totalRevenue / seconds : 0;
  const war = computeWar(efficiency, scale, totalAssets);

  const seasonId = currentSeasonId();
  const _id = `${userId}:${seasonId}`;
  const existing = await rankings().findOne({ _id });
  const baseline = existing?.baseline ?? totalRevenue; // 이번 시즌 첫 저장 = 시즌 시작 기준점 확정

  await rankings().updateOne(
    { _id },
    {
      $set: {
        userId,
        seasonId,
        baseline,
        seasonRevenue: totalRevenue - baseline,
        scale,
        efficiency,
        totalAssets,
        war,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export type RankEntry = {
  rank: number;
  userId: string;
  seasonRevenue: number;
  war: number;
  scale: number;
};

// 동점 처리 = 표준 경쟁 순위(1-2-2-4): 동점자는 같은 등수, 다음 등수는 인원수만큼 건너뜀.
export function withDenseRank(docs: readonly RankingDoc[]): RankEntry[] {
  let rank = 0;
  let lastValue: number | null = null;
  let seen = 0;
  return docs.map((d) => {
    seen += 1;
    if (d.seasonRevenue !== lastValue) {
      rank = seen;
      lastValue = d.seasonRevenue;
    }
    return { rank, userId: d.userId, seasonRevenue: d.seasonRevenue, war: d.war, scale: d.scale };
  });
}

export async function getSeasonRanking(seasonId: string): Promise<RankEntry[]> {
  const docs = await rankings()
    .find({ seasonId })
    .sort({ seasonRevenue: -1 })
    .limit(SERVER_CONFIG.rankPageSize)
    .toArray();
  return withDenseRank(docs);
}

export type HallOfFameSeason = { seasonId: string; entries: RankEntry[] };

// 지난 시즌들(현재 시즌 제외)의 시즌별 상위 랭커 — 별도 스냅샷 없이 rankings 컬렉션을 그대로 조회.
export async function getHallOfFame(excludeSeasonId: string): Promise<HallOfFameSeason[]> {
  const docs = await rankings()
    .find({ seasonId: { $ne: excludeSeasonId } })
    .sort({ seasonId: -1, seasonRevenue: -1 })
    .toArray();

  const bySeason = new Map<string, RankingDoc[]>();
  for (const doc of docs) {
    const list = bySeason.get(doc.seasonId) ?? [];
    if (list.length < SERVER_CONFIG.hallOfFameSize) list.push(doc);
    bySeason.set(doc.seasonId, list);
  }
  return [...bySeason.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([seasonId, seasonDocs]) => ({ seasonId, entries: withDenseRank(seasonDocs) }));
}
