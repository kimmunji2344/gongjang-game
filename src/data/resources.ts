// 자원/가공품 데이터 표. 코드에 하드코딩하지 않고 여기서만 관리한다.
// (Obsidian "자원 데이터 설계": 새 자원은 이 표에 한 줄 추가로 끝나야 함)

export type ResourceDef = {
  readonly id: string;
  readonly name: string;         // 표시명
  readonly produceGrade: number; // Node 기본 생산 속도 등급 (1~30) — 원자재만 의미
  readonly sellPrice: number;    // Exporter 기본 판매가 (G)
  readonly weight: number;       // Converter 셧다운 누적용 무게
  readonly tier: number;         // 0 = 원자재, 1+ = 가공 단계 (스펙: 단계 높을수록 판매가↑, 수치는 M3+)
};

// 미확정 수치는 전부 임시값 10 (사용자 규칙 2026-09-06).
// A1/A2/B1/C1 은 M2용 임시 플레이스홀더 — 사용자가 Obsidian 용어정리에 원자재/가공품/레시피를
// 정리해서 추가하면 그때 이름·수치·tier 를 실제 값으로 교체한다 (2026-09-07 사용자 지시).
export const RESOURCES: Record<string, ResourceDef> = {
  chip: { id: 'chip', name: '칩', produceGrade: 10, sellPrice: 10, weight: 10, tier: 0 },

  // --- M2 임시 플레이스홀더 ---
  A1: { id: 'A1', name: 'A1', produceGrade: 10, sellPrice: 10, weight: 10, tier: 0 },
  A2: { id: 'A2', name: 'A2', produceGrade: 10, sellPrice: 10, weight: 10, tier: 0 },
  B1: { id: 'B1', name: 'B1', produceGrade: 10, sellPrice: 10, weight: 10, tier: 1 },
  C1: { id: 'C1', name: 'C1', produceGrade: 10, sellPrice: 10, weight: 10, tier: 2 },
};
