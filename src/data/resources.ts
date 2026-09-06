// 자원/가공품 데이터 표. 코드에 하드코딩하지 않고 여기서만 관리한다.
// (Obsidian "자원 데이터 설계": 새 자원은 이 표에 한 줄 추가로 끝나야 함)

export type ResourceDef = {
  readonly id: string;
  readonly name: string;         // 표시명
  readonly produceGrade: number; // Node 기본 생산 속도 등급 (1~30)
  readonly sellPrice: number;    // Exporter 기본 판매가 (G)
  readonly weight: number;       // Converter 셧다운 누적용 무게 (M1 미사용)
};

// 미확정 수치는 전부 임시값 10 (사용자 규칙 2026-09-06)
export const RESOURCES: Record<string, ResourceDef> = {
  chip: { id: 'chip', name: '칩', produceGrade: 10, sellPrice: 10, weight: 10 },
};
