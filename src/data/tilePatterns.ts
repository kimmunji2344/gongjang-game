// 타일 도감(히든) 패턴 표 — provisional 1개로 시작 (스펙: "사전 힌트 없음, 우연히 발견"). 언제든 추가 가능.
import { Placeable } from '../sim/grid';

export type TilePatternDef = {
  readonly id: string;
  readonly name: string;
  readonly matches: (placeables: readonly Placeable[]) => boolean;
};

// Storage 4개가 2×2 정사각형으로 인접 배치
function hasStorageSquare(placeables: readonly Placeable[]): boolean {
  const tiles = new Set(
    placeables.filter((p) => p.kind === 'storage').map((p) => `${p.tile[0]},${p.tile[1]}`),
  );
  for (const key of tiles) {
    const [x, y] = key.split(',').map(Number);
    if (
      tiles.has(`${x + 1},${y}`) &&
      tiles.has(`${x},${y + 1}`) &&
      tiles.has(`${x + 1},${y + 1}`)
    ) {
      return true;
    }
  }
  return false;
}

export const TILE_PATTERNS: readonly TilePatternDef[] = [
  { id: 'storage_square', name: '정사각형 곳간', matches: hasStorageSquare },
];
