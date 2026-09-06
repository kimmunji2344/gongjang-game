// 타일 그리드와 설치물(Placeable) — 순수 함수 + 불변 데이터.

export type Tile = readonly [number, number];

export type Placeable =
  | { readonly kind: 'node'; readonly id: string; readonly resource: string; readonly tile: Tile }
  | { readonly kind: 'exporter'; readonly id: string; readonly tile: Tile }
  | { readonly kind: 'conveyor'; readonly id: string; readonly tile: Tile };

export const tileEq = (a: Tile, b: Tile): boolean => a[0] === b[0] && a[1] === b[1];
export const tileKey = (t: Tile): string => `${t[0]},${t[1]}`;

export const inBounds = (t: Tile, w: number, h: number): boolean =>
  t[0] >= 0 && t[1] >= 0 && t[0] < w && t[1] < h;

export const placeableAt = (ps: readonly Placeable[], t: Tile): Placeable | undefined =>
  ps.find((p) => tileEq(p.tile, t));

// 4방향 이웃 오프셋 (상 우 하 좌)
export const NEIGHBORS: readonly Tile[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
