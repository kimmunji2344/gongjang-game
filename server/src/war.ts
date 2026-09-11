// WAR(개인 능력치 단위) = 효율^0.4 × 규모^0.35 × log10(총자산)^0.25
// Obsidian "랭킹 / WAR / DB 시스템" 예시 2개를 원식(로그 없음) 그대로 검산해 일치 확인됨 → 효율·규모는 로그 미적용.
export function computeWar(efficiency: number, scale: number, totalAssets: number): number {
  const eff = Math.max(0, efficiency);
  const sc = Math.max(0, scale);
  const assets = Math.max(1, totalAssets); // log10(0) 방지 — 총자산 0 이하는 그 항이 0으로 수렴
  return eff ** 0.4 * sc ** 0.35 * Math.log10(assets) ** 0.25;
}
