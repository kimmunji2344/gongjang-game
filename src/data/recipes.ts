// Converter 가공 레시피 표. 하드코딩 금지 — 여기서만 관리.
// "공장 게임 확정 대기 목록" 1차 확정 반영 (2026-09-17). 캡슐·모듈 레시피는 자원 도감 완성 후 추가.

export type RecipeDef = {
  readonly id: string;
  readonly inputs: readonly string[]; // 서로 다른 자원 2종 이상 (RESOURCES 키)
  readonly output: string;            // 산출 가공품 (RESOURCES 키)
  readonly grade: number;             // 가공 1회 소요 속도 등급 (1~30)
};

export const RECIPES: readonly RecipeDef[] = [
  { id: 'core', inputs: ['chip', 'debris'], output: 'core', grade: 20 },
  { id: 'plate', inputs: ['chip', 'scrap'], output: 'plate', grade: 20 },
];

// 현재 보유(백로그)한 자원 종류로 가동 가능한 레시피 1개.
// 입력이 전부 갖춰진 레시피 중 RECIPES 배열 순서상 첫 번째.
// ponytail: 부분집합 매칭 + 배열 순서 우선 — 실제 레시피 표 확정되면 우선순위 규칙 재검토.
export function findRecipe(available: readonly string[]): RecipeDef | null {
  const have = new Set(available);
  return RECIPES.find((r) => r.inputs.every((i) => have.has(i))) ?? null;
}
