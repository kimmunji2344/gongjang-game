// M3-A 확장 구역 — 십자(+) 3×3 구역. 순수 함수.
// 구역 id = "zx,zy" (정수), 중앙 = "0,0". 각 구역은 size×size 타일.
// 중앙 구역 = 타일 [0..size-1, 0..size-1] → 기존 좌표 그대로. 팔/코너는 음수 좌표로 확장.

import { CONFIG } from '../data/config';
import type { Tile } from './grid';

const S = CONFIG.zone.size;
const SPAN = CONFIG.zone.span; // 구역 좌표 범위 -SPAN..SPAN

export const CENTER_ZONE = '0,0';

export function parseZone(id: string): [number, number] {
  const parts = id.split(',');
  return [Number(parts[0]), Number(parts[1])];
}

export function zoneOf(tile: Tile): string {
  return `${Math.floor(tile[0] / S)},${Math.floor(tile[1] / S)}`;
}

export function inOwnedZone(ownedZones: readonly string[], tile: Tile): boolean {
  return ownedZones.includes(zoneOf(tile));
}

function zoneInBounds(zx: number, zy: number): boolean {
  return Math.abs(zx) <= SPAN && Math.abs(zy) <= SPAN;
}

// 소유 구역과 변이 맞닿은(대각선 제외), 아직 안 산, 맵 범위 안의 구역 목록.
// 코너 구역은 중앙과 변이 안 닿으므로 인접 팔을 먼저 사야 자동으로 목록에 뜬다.
export function buyableZones(ownedZones: readonly string[]): string[] {
  const owned = new Set(ownedZones);
  const out = new Set<string>();
  for (const id of ownedZones) {
    const [zx, zy] = parseZone(id);
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const nx = zx + dx;
      const ny = zy + dy;
      const nid = `${nx},${ny}`;
      if (!owned.has(nid) && zoneInBounds(nx, ny)) out.add(nid);
    }
  }
  return [...out];
}

// 구역의 타일 경계 [minX, minY, maxX, maxY]
export function zoneTileBounds(id: string): [number, number, number, number] {
  const [zx, zy] = parseZone(id);
  return [zx * S, zy * S, zx * S + S - 1, zy * S + S - 1];
}

// 방향 표시용 이름 ("동", "북서" 등). 중앙은 "중앙".
export function zoneName(id: string): string {
  const [zx, zy] = parseZone(id);
  if (zx === 0 && zy === 0) return '중앙';
  const v = zy < 0 ? '북' : zy > 0 ? '남' : '';
  const h = zx < 0 ? '서' : zx > 0 ? '동' : '';
  return v + h;
}
