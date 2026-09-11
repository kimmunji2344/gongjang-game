import { describe, expect, it } from 'vitest';
import { computeWar } from '../src/war';
import { currentSeasonId } from '../src/season';
import { withDenseRank } from '../src/rank';
import type { RankingDoc } from '../src/db';

describe('WAR 공식 (Obsidian "랭킹 / WAR / DB 시스템" 예시 검산)', () => {
  it('효율30·규모80·총자산1억 → 약 30.4', () => {
    expect(computeWar(30, 80, 100_000_000)).toBeCloseTo(30.4, 1);
  });
  it('효율100·규모300·총자산100억 → 약 82.5', () => {
    // Obsidian 예시 자체가 반올림값(≈82.5) — 정확 계산값은 82.60
    expect(computeWar(100, 300, 10_000_000_000)).toBeCloseTo(82.5, 0);
  });
  it('총자산 0 이어도 에러 없이 0 (log10(0) 방지)', () => {
    expect(computeWar(10, 10, 0)).toBe(0);
  });
});

describe('시즌 ID (달력 월 단위, KST)', () => {
  it('연-월 형식(YYYY-MM)', () => {
    expect(currentSeasonId(new Date('2026-09-11T00:00:00Z'))).toBe('2026-09');
  });
  it('KST 자정 넘김 반영 (UTC 8/31 15시 = KST 9/1 0시)', () => {
    expect(currentSeasonId(new Date('2026-08-31T15:00:00Z'))).toBe('2026-09');
    expect(currentSeasonId(new Date('2026-08-31T14:59:00Z'))).toBe('2026-08');
  });
});

describe('동점 처리 — 표준 경쟁 순위(1-2-2-4)', () => {
  const mk = (userId: string, seasonRevenue: number): RankingDoc => ({
    _id: `${userId}:s`,
    userId,
    seasonId: 's',
    baseline: 0,
    seasonRevenue,
    scale: 0,
    efficiency: 0,
    totalAssets: 0,
    war: 0,
    updatedAt: new Date(0),
  });

  it('같은 수익은 같은 등수, 다음 등수는 동점자 수만큼 건너뜀', () => {
    const docs = [mk('a', 100), mk('b', 100), mk('c', 80), mk('d', 50)];
    expect(withDenseRank(docs).map((r) => r.rank)).toEqual([1, 1, 3, 4]);
  });
});
