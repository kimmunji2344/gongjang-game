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

// "공장 게임 확정 대기 목록" 1차 확정 반영 (2026-09-17). 캡슐·모듈 등 나머지 자원/가공품은
// "자원 도감 완성 후" 정하기로 해 아직 없음 — 추가될 때 이 표에 한 줄씩 더한다.
export const RESOURCES: Record<string, ResourceDef> = {
  // --- 원자재 (Node 로 생산, tier 0) ---
  chip: { id: 'chip', name: '칩', produceGrade: 20, sellPrice: 5, weight: 5, tier: 0 },
  scrap: { id: 'scrap', name: '스크랩', produceGrade: 20, sellPrice: 8, weight: 7, tier: 0 },
  debris: { id: 'debris', name: '데브리', produceGrade: 20, sellPrice: 20, weight: 15, tier: 0 },

  // --- 가공품 (Converter 로 생산, tier 1). produceGrade 는 Node 배치 대상이 아니라 미사용. ---
  core: { id: 'core', name: '코어', produceGrade: 20, sellPrice: 45, weight: 20, tier: 1 },
  plate: { id: 'plate', name: '플레이트', produceGrade: 20, sellPrice: 23, weight: 12, tier: 1 },
};
