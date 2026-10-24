// Converter 가공 레시피 표. 하드코딩 금지 — 여기서만 관리.
// 2026-10-25: 엑셀 <자원 정리표> 97개 레시피 반영 (순서 = 엑셀 순서). 가공 소요등급은 전부 임시 20.

export type RecipeDef = {
  readonly id: string;
  readonly inputs: readonly string[]; // 재료 2개 (RESOURCES 키). 같은 자원 2개도 허용 (예: scrap+scrap)
  readonly output: string;            // 산출 가공품 (RESOURCES 키)
  readonly grade: number;             // 가공 1회 소요 속도 등급 (1~30)
};

export const RECIPES: readonly RecipeDef[] = [
  // --- Tier 1 ---
  { id: 'metal', inputs: ['scrap', 'scrap'], output: 'metal', grade: 20 },
  { id: 'rock', inputs: ['debris', 'debris'], output: 'rock', grade: 20 },
  { id: 'wire', inputs: ['chip', 'chip'], output: 'wire', grade: 20 },
  { id: 'alloy', inputs: ['scrap', 'debris'], output: 'alloy', grade: 20 },
  { id: 'core', inputs: ['scrap', 'chip'], output: 'core', grade: 20 },
  { id: 'pulse', inputs: ['debris', 'chip'], output: 'pulse', grade: 20 },
  // --- Tier 2 ---
  { id: 'frame', inputs: ['metal', 'scrap'], output: 'frame', grade: 20 },
  { id: 'hull', inputs: ['metal', 'metal'], output: 'hull', grade: 20 },
  { id: 'armor', inputs: ['metal', 'rock'], output: 'armor', grade: 20 },
  { id: 'dust', inputs: ['rock', 'debris'], output: 'dust', grade: 20 },
  { id: 'meteor', inputs: ['rock', 'rock'], output: 'meteor', grade: 20 },
  { id: 'void', inputs: ['rock', 'wire'], output: 'void', grade: 20 },
  { id: 'relay', inputs: ['wire', 'chip'], output: 'relay', grade: 20 },
  { id: 'matrix', inputs: ['wire', 'wire'], output: 'matrix', grade: 20 },
  { id: 'gear', inputs: ['wire', 'metal'], output: 'gear', grade: 20 },
  { id: 'plate', inputs: ['alloy', 'scrap'], output: 'plate', grade: 20 },
  { id: 'cable', inputs: ['alloy', 'debris'], output: 'cable', grade: 20 },
  { id: 'grid', inputs: ['alloy', 'alloy'], output: 'grid', grade: 20 },
  { id: 'cell', inputs: ['core', 'scrap'], output: 'cell', grade: 20 },
  { id: 'drive', inputs: ['core', 'chip'], output: 'drive', grade: 20 },
  { id: 'sensor', inputs: ['core', 'core'], output: 'sensor', grade: 20 },
  { id: 'beacon', inputs: ['pulse', 'debris'], output: 'beacon', grade: 20 },
  { id: 'tuner', inputs: ['pulse', 'chip'], output: 'tuner', grade: 20 },
  { id: 'valve', inputs: ['pulse', 'pulse'], output: 'valve', grade: 20 },
  // --- Tier 3 ---
  { id: 'mesh', inputs: ['frame', 'scrap'], output: 'mesh', grade: 20 },
  { id: 'shield', inputs: ['frame', 'hull'], output: 'shield', grade: 20 },
  { id: 'base', inputs: ['hull', 'debris'], output: 'base', grade: 20 },
  { id: 'panel', inputs: ['hull', 'armor'], output: 'panel', grade: 20 },
  { id: 'pump', inputs: ['armor', 'chip'], output: 'pump', grade: 20 },
  { id: 'scope', inputs: ['armor', 'dust'], output: 'scope', grade: 20 },
  { id: 'frost', inputs: ['dust', 'scrap'], output: 'frost', grade: 20 },
  { id: 'shard', inputs: ['dust', 'meteor'], output: 'shard', grade: 20 },
  { id: 'essence', inputs: ['meteor', 'debris'], output: 'essence', grade: 20 },
  { id: 'coil', inputs: ['meteor', 'void'], output: 'coil', grade: 20 },
  { id: 'signal', inputs: ['void', 'chip'], output: 'signal', grade: 20 },
  { id: 'node', inputs: ['void', 'relay'], output: 'node', grade: 20 },
  { id: 'lens', inputs: ['relay', 'scrap'], output: 'lens', grade: 20 },
  { id: 'logic', inputs: ['relay', 'matrix'], output: 'logic', grade: 20 },
  { id: 'module', inputs: ['matrix', 'debris'], output: 'module', grade: 20 },
  { id: 'drone', inputs: ['matrix', 'gear'], output: 'drone', grade: 20 },
  { id: 'cover', inputs: ['gear', 'chip'], output: 'cover', grade: 20 },
  { id: 'probe', inputs: ['gear', 'plate'], output: 'probe', grade: 20 },
  { id: 'circuit', inputs: ['plate', 'cable'], output: 'circuit', grade: 20 },
  { id: 'solenoid', inputs: ['cable', 'grid'], output: 'solenoid', grade: 20 },
  { id: 'fiber', inputs: ['grid', 'cell'], output: 'fiber', grade: 20 },
  { id: 'battery', inputs: ['cell', 'drive'], output: 'battery', grade: 20 },
  { id: 'unit', inputs: ['drive', 'sensor'], output: 'unit', grade: 20 },
  { id: 'beam', inputs: ['sensor', 'beacon'], output: 'beam', grade: 20 },
  { id: 'filter', inputs: ['beacon', 'tuner'], output: 'filter', grade: 20 },
  { id: 'booster', inputs: ['tuner', 'valve'], output: 'booster', grade: 20 },
  { id: 'prism', inputs: ['valve', 'frame'], output: 'prism', grade: 20 },
  { id: 'trap', inputs: ['valve', 'void'], output: 'trap', grade: 20 },
  // --- Tier 4 ---
  { id: 'meter', inputs: ['mesh', 'scrap'], output: 'meter', grade: 20 },
  { id: 'station', inputs: ['mesh', 'shield'], output: 'station', grade: 20 },
  { id: 'vent', inputs: ['base', 'panel'], output: 'vent', grade: 20 },
  { id: 'intake', inputs: ['pump', 'scope'], output: 'intake', grade: 20 },
  { id: 'automa', inputs: ['frost', 'shard'], output: 'automa', grade: 20 },
  { id: 'reactor', inputs: ['essence', 'coil'], output: 'reactor', grade: 20 },
  { id: 'magnet', inputs: ['signal', 'node'], output: 'magnet', grade: 20 },
  { id: 'receiver', inputs: ['lens', 'logic'], output: 'receiver', grade: 20 },
  { id: 'frequency', inputs: ['module', 'drone'], output: 'frequency', grade: 20 },
  { id: 'scout', inputs: ['cover', 'probe'], output: 'scout', grade: 20 },
  { id: 'accelerator', inputs: ['circuit', 'solenoid'], output: 'accelerator', grade: 20 },
  { id: 'detector', inputs: ['fiber', 'battery'], output: 'detector', grade: 20 },
  { id: 'purifier', inputs: ['unit', 'beam'], output: 'purifier', grade: 20 },
  { id: 'engine', inputs: ['filter', 'booster'], output: 'engine', grade: 20 },
  { id: 'atlas', inputs: ['prism', 'trap'], output: 'atlas', grade: 20 },
  { id: 'kernel', inputs: ['meter', 'frame'], output: 'kernel', grade: 20 },
  { id: 'anchor', inputs: ['station', 'void'], output: 'anchor', grade: 20 },
  { id: 'pipe', inputs: ['vent', 'cable'], output: 'pipe', grade: 20 },
  { id: 'gyro', inputs: ['intake', 'beacon'], output: 'gyro', grade: 20 },
  { id: 'torch', inputs: ['automa', 'base'], output: 'torch', grade: 20 },
  { id: 'generator', inputs: ['reactor', 'shard'], output: 'generator', grade: 20 },
  { id: 'chime', inputs: ['magnet', 'lens'], output: 'chime', grade: 20 },
  { id: 'hologram', inputs: ['receiver', 'probe'], output: 'hologram', grade: 20 },
  { id: 'vault', inputs: ['frequency', 'unit'], output: 'vault', grade: 20 },
  { id: 'warp', inputs: ['scout', 'trap'], output: 'warp', grade: 20 },
  // --- Tier 5 ---
  { id: 'echo', inputs: ['accelerator', 'detector'], output: 'echo', grade: 20 },
  { id: 'remnant', inputs: ['purifier', 'engine'], output: 'remnant', grade: 20 },
  { id: 'lantern', inputs: ['atlas', 'kernel'], output: 'lantern', grade: 20 },
  { id: 'warmth', inputs: ['anchor', 'pipe'], output: 'warmth', grade: 20 },
  { id: 'whisper', inputs: ['gyro', 'torch'], output: 'whisper', grade: 20 },
  { id: 'silence', inputs: ['generator', 'chime'], output: 'silence', grade: 20 },
  { id: 'catcher', inputs: ['hologram', 'vault'], output: 'catcher', grade: 20 },
  { id: 'rune', inputs: ['warp', 'echo'], output: 'rune', grade: 20 },
  { id: 'sphere', inputs: ['remnant', 'scrap'], output: 'sphere', grade: 20 },
  { id: 'melody', inputs: ['lantern', 'debris'], output: 'melody', grade: 20 },
  { id: 'relic', inputs: ['warmth', 'chip'], output: 'relic', grade: 20 },
  { id: 'portal', inputs: ['whisper', 'metal'], output: 'portal', grade: 20 },
  { id: 'drift', inputs: ['silence', 'rock'], output: 'drift', grade: 20 },
  { id: 'haven', inputs: ['catcher', 'wire'], output: 'haven', grade: 20 },
  { id: 'aurora', inputs: ['rune', 'alloy'], output: 'aurora', grade: 20 },
  { id: 'lullaby', inputs: ['sphere', 'warp'], output: 'lullaby', grade: 20 },
  { id: 'terrarium', inputs: ['melody', 'echo'], output: 'terrarium', grade: 20 },
  { id: 'globe', inputs: ['relic', 'remnant'], output: 'globe', grade: 20 },
  { id: 'refuge', inputs: ['portal', 'lantern'], output: 'refuge', grade: 20 },
  { id: 'harmony', inputs: ['drift', 'warmth'], output: 'harmony', grade: 20 },
];

// 보유(백로그) 재고로 가동 가능한 레시피 1개.
// 서로 다른 재료 레시피를 먼저, 같은 재료 2개 레시피는 그다음, 각 그룹 안에서는 RECIPES 순서.
// (스크랩+칩을 이었는데 스크랩이 먼저 2개 쌓였다고 메탈이 나오는 것을 막기 위함)
// ponytail: 우선순위는 이 한 줄 규칙뿐 — 재료 3종 이상이 섞여 들어오면 앞선 레시피가 이긴다.
export function findRecipe(stock: Readonly<Record<string, number>>): RecipeDef | null {
  const can = (r: RecipeDef): boolean => {
    const need: Record<string, number> = {};
    for (const i of r.inputs) need[i] = (need[i] ?? 0) + 1;
    return Object.entries(need).every(([k, n]) => (stock[k] ?? 0) >= n);
  };
  const mixed = (r: RecipeDef): boolean => new Set(r.inputs).size > 1;
  return RECIPES.find((r) => mixed(r) && can(r)) ?? RECIPES.find((r) => !mixed(r) && can(r)) ?? null;
}
