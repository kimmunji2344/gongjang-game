// 코어 시뮬레이션 — 고정 timestep, 순수 함수. 상태를 매 틱 새로 만든다(불변).
// "공장(Factory)"은 객체로 저장하지 않고 매 틱 그래프 탐색으로 판정한다 (Obsidian 결정사항).

import { CONFIG } from '../data/config';
import { RESOURCES } from '../data/resources';
import { gradeToTicks } from '../data/speed';
import {
  NEIGHBORS,
  Placeable,
  Tile,
  inBounds,
  placeableAt,
  tileEq,
  tileKey,
} from './grid';

// 컨베이어 위를 이동 중인 자원 1개
export type Cargo = {
  readonly resource: string;
  readonly nodeId: string; // 어느 Node가 만든 것 = 어느 경로를 타는지
  readonly index: number;  // 경로(path) 상 현재 타일 인덱스
  readonly ticksOnTile: number;
};

export type SimState = {
  readonly tick: number;
  readonly gold: number;
  readonly placeables: readonly Placeable[];
  readonly cargo: readonly Cargo[];
  readonly nodeCooldown: Readonly<Record<string, number>>; // nodeId → 다음 생산까지 남은 틱
  readonly freeConveyors: number;
};

const CONVEYOR_GRADE = 10; // 임시 =10: 컨베이어 이동 속도 등급 (오브젝트별 매핑표 미정)

// ---- 초기 상태 --------------------------------------------------------------

export function initialState(): SimState {
  const k = CONFIG.startKit;
  const placeables: Placeable[] = [
    { kind: 'node', id: 'node-1', resource: k.node.resource, tile: k.node.tile },
    { kind: 'exporter', id: 'exporter-1', tile: k.exporter.tile },
  ];
  return {
    tick: 0,
    gold: CONFIG.startingGold,
    placeables,
    cargo: [],
    nodeCooldown: {
      'node-1': gradeToTicks(RESOURCES[k.node.resource].produceGrade, CONFIG.tickHz),
    },
    freeConveyors: CONFIG.freeConveyors,
  };
}

// ---- 경로 탐색 (Node → Exporter) ------------------------------------------

// 반환: [컨베이어 타일..., Exporter 타일] / 연결 안 되어 있으면 null
export function findPath(placeables: readonly Placeable[], node: Placeable): Tile[] | null {
  const conveyors = new Set(
    placeables.filter((p) => p.kind === 'conveyor').map((p) => tileKey(p.tile)),
  );
  const exporters = placeables.filter((p) => p.kind === 'exporter');

  const queue: Tile[][] = [[node.tile]];
  const seen = new Set<string>([tileKey(node.tile)]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const cur = path[path.length - 1];
    for (const [dx, dy] of NEIGHBORS) {
      const next: Tile = [cur[0] + dx, cur[1] + dy];
      const key = tileKey(next);
      if (seen.has(key)) continue;
      if (exporters.some((e) => tileEq(e.tile, next))) {
        return [...path.slice(1), next]; // node 타일 제외, exporter 타일 포함
      }
      if (conveyors.has(key)) {
        seen.add(key);
        queue.push([...path, next]);
      }
    }
  }
  return null;
}

function computePaths(placeables: readonly Placeable[]): Map<string, Tile[]> {
  const paths = new Map<string, Tile[]>();
  for (const p of placeables) {
    if (p.kind !== 'node') continue;
    const path = findPath(placeables, p);
    if (path) paths.set(p.id, path);
  }
  return paths;
}

// ---- 틱 진행 --------------------------------------------------------------

export function step(state: SimState): SimState {
  const paths = computePaths(state.placeables);
  const perTile = gradeToTicks(CONVEYOR_GRADE, CONFIG.tickHz);

  let gold = state.gold;
  const nextCargo: Cargo[] = [];

  // 1) 이동 중인 자원 전진 (연결이 끊긴 경로는 정지 없이 소멸 처리)
  for (const c of state.cargo) {
    const path = paths.get(c.nodeId);
    if (!path || c.index >= path.length - 1) continue; // 경로 없음/짧아짐 → 소멸
    const t = c.ticksOnTile + 1;
    if (t < perTile) {
      nextCargo.push({ ...c, ticksOnTile: t });
      continue;
    }
    const nextIndex = c.index + 1;
    if (nextIndex >= path.length - 1) {
      gold += RESOURCES[c.resource].sellPrice; // 다음 칸이 Exporter → 판매
    } else {
      nextCargo.push({ ...c, index: nextIndex, ticksOnTile: 0 });
    }
  }

  // 2) Node 생산
  const nodeCooldown: Record<string, number> = {};
  for (const p of state.placeables) {
    if (p.kind !== 'node') continue;
    const cd = (state.nodeCooldown[p.id] ?? 0) - 1;
    const path = paths.get(p.id);
    if (cd <= 0 && path && path.length > 0) {
      nextCargo.push({ resource: p.resource, nodeId: p.id, index: 0, ticksOnTile: 0 });
      nodeCooldown[p.id] = gradeToTicks(RESOURCES[p.resource].produceGrade, CONFIG.tickHz);
    } else {
      nodeCooldown[p.id] = Math.max(0, cd);
    }
  }

  return { ...state, tick: state.tick + 1, gold, cargo: nextCargo, nodeCooldown };
}

// ---- 배치 / 철거 (실패 시 한국어 사유 문자열 반환) --------------------------

export type PlaceResult = SimState | string;

const occupied = (state: SimState, tile: Tile): boolean =>
  placeableAt(state.placeables, tile) !== undefined;

export function placeConveyor(state: SimState, tile: Tile): PlaceResult {
  if (!inBounds(tile, CONFIG.grid.w, CONFIG.grid.h)) return '맵 밖입니다';
  if (occupied(state, tile)) return '이미 설치물이 있습니다';
  const useFree = state.freeConveyors > 0;
  if (!useFree && state.gold < CONFIG.conveyorCost) {
    return `골드 부족 (필요 ${CONFIG.conveyorCost}G)`;
  }
  return {
    ...state,
    gold: useFree ? state.gold : state.gold - CONFIG.conveyorCost,
    freeConveyors: useFree ? state.freeConveyors - 1 : 0,
    placeables: [
      ...state.placeables,
      { kind: 'conveyor', id: `cv-${tile[0]}-${tile[1]}`, tile },
    ],
  };
}

export function placeBuilding(
  state: SimState,
  kind: 'node' | 'exporter',
  tile: Tile,
  resource = 'chip',
): PlaceResult {
  if (!inBounds(tile, CONFIG.grid.w, CONFIG.grid.h)) return '맵 밖입니다';
  if (occupied(state, tile)) return '이미 설치물이 있습니다';
  if (state.gold < CONFIG.buildingCost) return `골드 부족 (필요 ${CONFIG.buildingCost}G)`;

  const id = `${kind}-${tile[0]}-${tile[1]}`;
  const placeable: Placeable =
    kind === 'node' ? { kind, id, resource, tile } : { kind, id, tile };

  const next: SimState = {
    ...state,
    gold: state.gold - CONFIG.buildingCost,
    placeables: [...state.placeables, placeable],
  };
  if (kind === 'node') {
    return {
      ...next,
      nodeCooldown: {
        ...next.nodeCooldown,
        [id]: gradeToTicks(RESOURCES[resource].produceGrade, CONFIG.tickHz),
      },
    };
  }
  return next;
}

export function removePlaceable(state: SimState, tile: Tile): PlaceResult {
  const p = placeableAt(state.placeables, tile);
  if (!p) return '설치물이 없습니다';
  if (p.id === 'node-1' || p.id === 'exporter-1') return '시작 설비는 철거할 수 없습니다';

  const placeables = state.placeables.filter((x) => x.id !== p.id);
  const cargo =
    p.kind === 'node' ? state.cargo.filter((c) => c.nodeId !== p.id) : state.cargo;
  const nodeCooldown = { ...state.nodeCooldown };
  if (p.kind === 'node') delete nodeCooldown[p.id];
  return { ...state, placeables, cargo, nodeCooldown };
}
