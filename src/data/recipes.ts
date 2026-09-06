// Converter 가공 레시피 표. 하드코딩 금지 — 여기서만 관리.
// M2 임시 플레이스홀더 (R1/R2). 사용자가 Obsidian 용어정리에 실제 레시피를 정리해 추가하면
// 그때 교체한다 (2026-09-07 사용자 지시).

export type RecipeDef = {
  readonly id: string;
  readonly inputs: readonly string[]; // 서로 다른 자원 2종 이상 (RESOURCES 키)
  readonly output: string;            // 산출 가공품 (RESOURCES 키)
  readonly grade: number;             // 가공 1회 소요 속도 등급 (1~30). 임시 =10 → 1초
};

export const RECIPES: readonly RecipeDef[] = [
  { id: 'R1', inputs: ['A1', 'A2'], output: 'B1', grade: 10 },
  { id: 'R2', inputs: ['A1', 'B1'], output: 'C1', grade: 10 }, // 재귀 가공 예시 (B1 을 다시 입력)
];

// 현재 보유(백로그)한 자원 종류로 가동 가능한 레시피 1개.
// 입력이 전부 갖춰진 레시피 중 RECIPES 배열 순서상 첫 번째.
// ponytail: 부분집합 매칭 + 배열 순서 우선 — 실제 레시피 표 확정되면 우선순위 규칙 재검토.
export function findRecipe(available: readonly string[]): RecipeDef | null {
  const have = new Set(available);
  return RECIPES.find((r) => r.inputs.every((i) => have.has(i))) ?? null;
}
