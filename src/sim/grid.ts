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
  | { readonly kind: 'conveyor'; readonly id: string; readonly tile: Tile; readonly dir: Dir }
  // Converter: 2×1 풋프린트(2026-09-20 확정) — tile(뒤칸) + tile 에서 dir 방향으로 한 칸(앞칸, 파생값, 별도 저장 안 함).
  //            긴 면(2칸) 양쪽 = 입력, 앞칸의 dir 방향(짧은 면) = 출력, 뒤칸의 반대편(짧은 면)은 닫힘.
  | { readonly kind: 'converter'; readonly id: string; readonly tile: Tile; readonly dir: Dir }
  // Storage: 방향 없음 (Exporter 처럼 어느 방향에서 오는 컨베이어든 받음).
  | { readonly kind: 'storage'; readonly id: string; readonly tile: Tile };

export const tileEq = (a: Tile, b: Tile): boolean => a[0] === b[0] && a[1] === b[1];
export const tileKey = (t: Tile): string => `${t[0]},${t[1]}`;

// 한 타일에서 방향 d로 한 칸 이동한 좌표
export const stepTile = (t: Tile, d: Dir): Tile => [t[0] + DIR_VEC[d][0], t[1] + DIR_VEC[d][1]];

// Converter 의 앞칸(출력 방향 쪽 파생 타일)
export const converterFront = (p: { tile: Tile; dir: Dir }): Tile => stepTile(p.tile, p.dir);

export const placeableAt = (ps: readonly Placeable[], t: Tile): Placeable | undefined =>
  ps.find((p) => tileEq(p.tile, t) || (p.kind === 'converter' && tileEq(converterFront(p), t)));
