// 타일 그리드와 설치물(Placeable) — 순수 함수 + 불변 데이터.

export type Tile = readonly [number, number];

// 절대 방향 (상 우 하 좌). 컨베이어와 Node가 가짐. Exporter는 방향 없음(어느 쪽에서든 받음).
export type Dir = 'N' | 'E' | 'S' | 'W';

export const DIR_VEC: Record<Dir, Tile> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

export const DIR_OPP: Record<Dir, Dir> = { N: 'S', E: 'W', S: 'N', W: 'E' };

export const DIR_ARROW: Record<Dir, string> = { N: '↑', E: '→', S: '↓', W: '←' };

export type Placeable =
  | {
      readonly kind: 'node';
      readonly id: string;
      readonly resource: string;
      readonly tile: Tile;
      readonly dir: Dir;
    }
  | { readonly kind: 'exporter'; readonly id: string; readonly tile: Tile }
  | { readonly kind: 'conveyor'; readonly id: string; readonly tile: Tile; readonly dir: Dir };

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
