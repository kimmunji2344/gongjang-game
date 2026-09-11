// 업적 도감 표 — provisional 목록 (스펙: "누적 판매량, 누적 퀘스트 진행 등"). 언제든 교체/추가 가능.
// 각 업적은 SimState 파생 지표(metric) 가 threshold 이상이면 달성 — 전부 단조증가값이라 한번 달성하면 영구 유지.

export type AchievementMetric = 'totalRevenue' | 'zoneCount' | 'npcQuestsDone';

export type AchievementDef = {
  readonly id: string;
  readonly name: string;
  readonly metric: AchievementMetric;
  readonly threshold: number;
};

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'sales_100', name: '첫 거래', metric: 'totalRevenue', threshold: 100 },
  { id: 'sales_1000', name: '숙련 상인', metric: 'totalRevenue', threshold: 1000 },
  { id: 'sales_10000', name: '무역왕', metric: 'totalRevenue', threshold: 10000 },
  { id: 'zones_3', name: '영토 확장', metric: 'zoneCount', threshold: 3 },
  { id: 'npc_5', name: '단골 손님', metric: 'npcQuestsDone', threshold: 5 },
];
