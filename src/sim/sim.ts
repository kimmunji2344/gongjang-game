// 코어 시뮬레이션 — 고정 timestep, 순수 함수. 상태를 매 틱 새로 만든다(불변).
// "공장(Factory)"은 객체로 저장하지 않고 매 틱 그래프 탐색으로 판정한다 (Obsidian 결정사항).

import { CONFIG } from '../data/config';
import { RESOURCES } from '../data/resources';
import { gradeToTicks } from '../data/speed';
import {
  DIR_OPP,
  DIR_VEC,
  Dir,
  Placeable,
  Tile,
  inBounds,
  placeableAt,
  tileKey,
} from './grid';

// 한 타일에서 방향 d로 한 칸 이동한 좌표
const stepTile = (t: Tile, d: Dir): Tile => [t[0] + DIR_VEC[d][0], t[1] + DIR_VEC[d][1]];

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
    { kind: 'node', id: 'node-1', resource: k.node.resource, tile: k.node.tile, dir: k.node.dir },
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

// ---- 경로 추적 (Node 방향 → 컨베이어 방향들 → Exporter) --------------------

// Node.dir에서 출발해 각 컨베이어의 고정 방향을 타일 단위로 따라간다.
// 꺾임은 각 타일이 자기 방향을 갖는 것만으로 자동 발생 (자동 방향 지정 없음).
// 반환: [경유 컨베이어 타일..., Exporter 타일] / Exporter에 도달 못 하면 null
export function findPath(placeables: readonly Placeable[], node: Placeable): Tile[] | null {
  if (node.kind !== 'node') return null;

  const path: Tile[] = [];
  const seen = new Set<string>();
  let cur: Tile = stepTile(node.tile, node.dir);

  for (;;) {
    const key = tileKey(cur);
    if (seen.has(key)) return null; // 루프 (Exporter 없는 순환)
    seen.add(key);

    const p = placeableAt(placeables, cur);
    if (!p) return null; // 빈 칸 / 맵 밖 → 막힘
    if (p.kind === 'exporter') return [...path, cur];
    if (p.kind !== 'conveyor') return null; // Node 등 → 막힘

    path.push(cur);
    cur = stepTile(cur, p.dir);
  }
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
      if (path.length === 1) {
        gold += RESOURCES[p.resource].sellPrice; // Node가 Exporter에 직접 인접 → 즉시 판매
      } else {
        nextCargo.push({ resource: p.resource, nodeId: p.id, index: 0, ticksOnTile: 0 });
      }
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

// tile에 dir 방향으로 놓을 때, 바로 앞칸의 설치물이 나를 정반대로 마주보면 true.
// (예: → 를 놓는데 앞칸이 ← ). 앞칸만 검사하면 "서로 마주봄"은 모두 잡힌다.
function facesHeadOn(placeables: readonly Placeable[], tile: Tile, dir: Dir): boolean {
  const front = placeableAt(placeables, stepTile(tile, dir));
  if (!front || front.kind === 'exporter') return false;
  return front.dir === DIR_OPP[dir];
}

const HEAD_ON_MSG = '마주보는 방향으로는 설치할 수 없습니다';

export function placeConveyor(state: SimState, tile: Tile, dir: Dir): PlaceResult {
  if (!inBounds(tile, CONFIG.grid.w, CONFIG.grid.h)) return '맵 밖입니다';
  if (occupied(state, tile)) return '이미 설치물이 있습니다';
  if (facesHeadOn(state.placeables, tile, dir)) return HEAD_ON_MSG;
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
      { kind: 'conveyor', id: `cv-${tile[0]}-${tile[1]}`, tile, dir },
    ],
  };
}

export function placeBuilding(
  state: SimState,
  kind: 'node' | 'exporter',
  tile: Tile,
  resource = 'chip',
  dir: Dir = 'E',
): PlaceResult {
  if (!inBounds(tile, CONFIG.grid.w, CONFIG.grid.h)) return '맵 밖입니다';
  if (occupied(state, tile)) return '이미 설치물이 있습니다';
  if (state.gold < CONFIG.buildingCost) return `골드 부족 (필요 ${CONFIG.buildingCost}G)`;
  if (kind === 'node' && facesHeadOn(state.placeables, tile, dir)) return HEAD_ON_MSG;

  const id = `${kind}-${tile[0]}-${tile[1]}`;
  const placeable: Placeable =
    kind === 'node' ? { kind, id, resource, tile, dir } : { kind, id, tile };

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

// 철거비 = 해당 설치물의 설치 비용과 동일 (Obsidian: "철거 비용은 설치 비용과 동일").
// 임시 =10. 시작 설비(무료 지급분)도 동일 규칙 적용.
function removalFee(kind: Placeable['kind']): number {
  return kind === 'conveyor' ? CONFIG.conveyorCost : CONFIG.buildingCost;
}

export function removePlaceable(state: SimState, tile: Tile): PlaceResult {
  const p = placeableAt(state.placeables, tile);
  if (!p) return '설치물이 없습니다';

  const fee = removalFee(p.kind);
  if (state.gold < fee) return `골드 부족 (철거비 ${fee}G)`;

  const placeables = state.placeables.filter((x) => x.id !== p.id);
  const cargo =
    p.kind === 'node' ? state.cargo.filter((c) => c.nodeId !== p.id) : state.cargo;
  const nodeCooldown = { ...state.nodeCooldown };
  if (p.kind === 'node') delete nodeCooldown[p.id];
  return { ...state, gold: state.gold - fee, placeables, cargo, nodeCooldown };
}
