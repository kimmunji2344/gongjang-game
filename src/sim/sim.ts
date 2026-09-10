// 코어 시뮬레이션 — 고정 timestep, 순수 함수. 상태를 매 틱 새로 만든다(불변).
// "공장(Factory)"은 객체로 저장하지 않고 매 틱 그래프 탐색으로 판정한다 (Obsidian 결정사항).
//
// M2: 라우팅이 단일 경로(Node→컨베이어→Exporter)에서 그래프로 확장.
//   종착 = Exporter(판매) / Storage(저장) / Converter(가공 입력).
//   Converter 는 입력을 재고(backlog)로 쌓아두고 레시피가 갖춰지면 가공 → 출력을 다시 라우팅.
//   셧다운 = Converter 재고 누적 무게 ≥ 한도 → 그 Converter 로 유입되는 공장(상류) 정지.

import { CONFIG } from '../data/config';
import { findRecipe } from '../data/recipes';
import { RESOURCES } from '../data/resources';
import { gradeToTicks } from '../data/speed';
import {
  DIR_OPP,
  DIR_VEC,
  Dir,
  Placeable,
  Tile,
  placeableAt,
  tileKey,
} from './grid';
import { CENTER_ZONE, buyableZones, inOwnedZone } from './zones';

// 한 타일에서 방향 d로 한 칸 이동한 좌표
const stepTile = (t: Tile, d: Dir): Tile => [t[0] + DIR_VEC[d][0], t[1] + DIR_VEC[d][1]];

// 컨베이어 위를 이동 중인 자원 1개
export type Cargo = {
  readonly resource: string;
  readonly sourceId: string; // 어느 소스(Node id 또는 Converter id)가 만든 것 = 어느 경로를 타는지
  readonly index: number;    // 경로(path) 상 현재 타일 인덱스
  readonly ticksOnTile: number;
};

// storageId → (resource → 개수). M3-B: 자원별로 나눠 보관 (업그레이드 재료 인출용).
export type StorageMap = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type SimState = {
  readonly tick: number;
  readonly gold: number;
  readonly placeables: readonly Placeable[];
  readonly cargo: readonly Cargo[];
  readonly nodeCooldown: Readonly<Record<string, number>>;       // nodeId → 다음 생산까지 남은 틱
  readonly converterCooldown: Readonly<Record<string, number>>;  // convId → 다음 가공 완료까지 남은 틱
  readonly converterBacklog: Readonly<Record<string, Readonly<Record<string, number>>>>; // convId → resource → 개수
  readonly storage: StorageMap;                                  // storageId → resource → 개수
  readonly freeConveyors: number;
  // M3-A 확장/해금
  readonly ownedZones: readonly string[];        // 소유 구역 id ("zx,zy"), 시작 ["0,0"]
  readonly unlockedResources: readonly string[]; // Node 로 배치 가능한 원자재, 시작 ["chip"]
  readonly chipSold: number;                     // 누적 칩 판매 개수 (자원 해금 게이트용)
  // M3-B 레벨링 (전부 기본 레벨 1 / 진행도 0)
  readonly nodeLevel: Readonly<Record<string, number>>;
  readonly storageLevel: Readonly<Record<string, number>>;
  readonly exporterLevel: Readonly<Record<string, number>>;
  readonly exporterProgress: Readonly<Record<string, number>>; // exporterId → 레벨업 진행 누적(판매 수)
};

// ---- 파생 수치 (레벨 반영) ------------------------------------------------

// Node 유효 생산 등급 (레벨 오를수록 등급↓ = 빨라짐, 등급 1 캡)
export function nodeGrade(resource: string, level: number): number {
  const base = RESOURCES[resource].produceGrade;
  return Math.max(1, base - (level - 1) * CONFIG.nodeGradePerLevel);
}

// Storage 유효 용량 (자원 개수 합계 기준)
export function storageCap(level: number): number {
  return CONFIG.storageCapacity + (level - 1) * CONFIG.storageCapPerLevel;
}

// 1개 판매 시 받는 골드 = 기본가 × tier 배율 × Exporter 레벨 배율 (정수 반올림)
export function effectivePrice(resource: string, exporterLevel: number): number {
  const def = RESOURCES[resource];
  const tierMult = 1 + def.tier * CONFIG.tierPriceBonus;
  const exMult = 1 + (exporterLevel - 1) * CONFIG.exporterLevelBonus;
  return Math.round(def.sellPrice * tierMult * exMult);
}

// storageId 에 담긴 자원 총 개수
export function storageTotal(state: SimState, storageId: string): number {
  return Object.values(state.storage[storageId] ?? {}).reduce((a, b) => a + b, 0);
}

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
    converterCooldown: {},
    converterBacklog: {},
    storage: {},
    freeConveyors: CONFIG.freeConveyors,
    ownedZones: [CENTER_ZONE],
    unlockedResources: ['chip'],
    chipSold: 0,
    nodeLevel: {},
    storageLevel: {},
    exporterLevel: {},
    exporterProgress: {},
  };
}

// v3 이하 storage(storageId → number) 를 v4(storageId → resource → 개수) 로 변환.
// v3 는 자원 종류를 기록하지 않았으므로 내용은 폐기(건물·레벨은 유지).
function normalizeStorage(raw: unknown): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (raw && typeof raw === 'object') {
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      out[id] = v && typeof v === 'object' ? { ...(v as Record<string, number>) } : {};
    }
  }
  return out;
}

// 불러온 세이브를 현재 스키마로 맞춘다.
//  v1 → v2 : M2 필드(converter*/storage) 채움 + Cargo.nodeId → sourceId
//  v2 → v3 : M3-A 필드(ownedZones/unlockedResources/chipSold) 채움
//  v3 → v4 : M3-B 레벨 필드 채움 + storage 자원별 맵으로 변환(v3 내용 폐기)
export function normalizeState(s: SimState): SimState {
  type LegacyCargo = Cargo & { nodeId?: string };
  return {
    ...s,
    cargo: (s.cargo ?? []).map((c) => {
      const lc = c as LegacyCargo;
      return lc.sourceId
        ? c
        : { resource: lc.resource, sourceId: lc.nodeId ?? '', index: lc.index, ticksOnTile: lc.ticksOnTile };
    }),
    nodeCooldown: s.nodeCooldown ?? {},
    converterCooldown: s.converterCooldown ?? {},
    converterBacklog: s.converterBacklog ?? {},
    storage: normalizeStorage(s.storage),
    ownedZones: s.ownedZones?.length ? s.ownedZones : [CENTER_ZONE],
    unlockedResources: s.unlockedResources?.length ? s.unlockedResources : ['chip'],
    chipSold: s.chipSold ?? 0,
    nodeLevel: s.nodeLevel ?? {},
    storageLevel: s.storageLevel ?? {},
    exporterLevel: s.exporterLevel ?? {},
    exporterProgress: s.exporterProgress ?? {},
  };
}

// ---- 경로 라우팅 (소스 방향 → 컨베이어 방향들 → 종착) ----------------------

export type SinkKind = 'exporter' | 'storage' | 'converter' | 'blocked';
export type Route = {
  readonly path: readonly Tile[]; // [경유 컨베이어..., 종착 타일] (blocked 면 종착 타일 없음)
  readonly sink: SinkKind;
  readonly sinkId: string | null;
};

// first 타일에서 시작해 각 컨베이어의 고정 방향을 타일 단위로 따라간다.
// 빈 칸 / 맵 밖 / 루프 / Node 가로막음 = blocked.
function walk(placeables: readonly Placeable[], first: Tile): Route {
  const path: Tile[] = [];
  const seen = new Set<string>();
  let cur: Tile = first;

  for (;;) {
    const key = tileKey(cur);
    if (seen.has(key)) return { path, sink: 'blocked', sinkId: null };
    seen.add(key);

    const p = placeableAt(placeables, cur);
    if (!p) return { path, sink: 'blocked', sinkId: null };
    if (p.kind === 'exporter') return { path: [...path, cur], sink: 'exporter', sinkId: p.id };
    if (p.kind === 'storage') return { path: [...path, cur], sink: 'storage', sinkId: p.id };
    if (p.kind === 'converter') return { path: [...path, cur], sink: 'converter', sinkId: p.id };
    if (p.kind !== 'conveyor') return { path, sink: 'blocked', sinkId: null };

    path.push(cur);
    cur = stepTile(cur, p.dir);
  }
}

// Node / Converter 는 자기 방향(dir)으로 출력한다.
function routeFrom(placeables: readonly Placeable[], source: Placeable): Route {
  if (source.kind !== 'node' && source.kind !== 'converter') {
    return { path: [], sink: 'blocked', sinkId: null };
  }
  return walk(placeables, stepTile(source.tile, source.dir));
}

// 소스 id(Node/Converter) → 그 소스의 출력 경로
export function computeRoutes(placeables: readonly Placeable[]): Map<string, Route> {
  const m = new Map<string, Route>();
  for (const p of placeables) {
    if (p.kind === 'node' || p.kind === 'converter') m.set(p.id, routeFrom(placeables, p));
  }
  return m;
}

// 렌더용: 셧다운으로 정지된 설치물 id 집합 (Node·컨베이어). 상류가 얼어붙은 것들.
export function stoppedPlaceables(state: SimState): ReadonlySet<string> {
  const routes = computeRoutes(state.placeables);
  return frozenSet(state.placeables, routes, shutdownSet(state));
}

// M1 호환 + 렌더용: 소스에서 종착까지 경로 타일(막혀 있으면 null).
export function findPath(placeables: readonly Placeable[], source: Placeable): Tile[] | null {
  const r = routeFrom(placeables, source);
  return r.sink === 'blocked' ? null : [...r.path];
}

// ---- 셧다운 판정 (Converter 재고 무게 기반) --------------------------------

function converterWeight(bl: Readonly<Record<string, number>>): number {
  let w = 0;
  for (const [r, n] of Object.entries(bl)) w += n * (RESOURCES[r]?.weight ?? 0);
  return w;
}

// 재고 누적 무게가 한도 이상인 Converter id 집합
export function shutdownSet(state: SimState): ReadonlySet<string> {
  const s = new Set<string>();
  for (const [id, bl] of Object.entries(state.converterBacklog)) {
    if (converterWeight(bl) >= CONFIG.shutdownWeight) s.add(id);
  }
  return s;
}

// UI/디버그용: 셧다운된 Converter → 과잉 자원(무게 기여 큰 순) + 현재 무게
export function shutdownInfo(state: SimState): Record<string, { resources: string[]; weight: number }> {
  const out: Record<string, { resources: string[]; weight: number }> = {};
  for (const id of shutdownSet(state)) {
    const bl = state.converterBacklog[id] ?? {};
    const resources = Object.entries(bl)
      .filter(([, n]) => n > 0)
      .sort(
        (a, b) =>
          b[1] * (RESOURCES[b[0]]?.weight ?? 0) - a[1] * (RESOURCES[a[0]]?.weight ?? 0),
      )
      .map(([r]) => r);
    out[id] = { resources, weight: converterWeight(bl) };
  }
  return out;
}

// 셧다운된 Converter 로 (재귀적으로) 유입되는 소스 + 경유 컨베이어 = 정지 대상.
// 셧다운된 Converter 자신은 정지 대상이 아니다 — 재고를 계속 소모해 스스로 재가동한다
// (Obsidian "재고가 소모되며 자연스럽게 재가동"). 출력 경로도 얼리지 않는다.
function frozenSet(
  placeables: readonly Placeable[],
  routes: Map<string, Route>,
  shut: ReadonlySet<string>,
): ReadonlySet<string> {
  if (shut.size === 0) return new Set();
  const byId = new Map(placeables.map((p) => [p.id, p]));
  const targets = new Set(shut); // "이 Converter 로 유입되면 상류 정지"
  const frozen = new Set<string>();
  let grew = true;

  while (grew) {
    grew = false;
    for (const [srcId, route] of routes) {
      if (route.sink !== 'converter' || !route.sinkId || !targets.has(route.sinkId)) continue;

      if (!frozen.has(srcId)) {
        frozen.add(srcId);
        grew = true;
      }
      for (const t of route.path) {
        const pp = placeableAt(placeables, t);
        if (pp && pp.kind === 'conveyor' && !frozen.has(pp.id)) {
          frozen.add(pp.id);
          grew = true;
        }
      }
      const src = byId.get(srcId);
      if (src && src.kind === 'converter' && !targets.has(srcId)) {
        targets.add(srcId); // 상류 Converter 도 정지 계보에 편입
        grew = true;
      }
    }
  }
  return frozen;
}

// ---- 틱 진행 --------------------------------------------------------------

export function step(state: SimState): SimState {
  const routes = computeRoutes(state.placeables);
  const shut = shutdownSet(state);
  const frozen = frozenSet(state.placeables, routes, shut);
  const perTile = gradeToTicks(CONVEYOR_GRADE, CONFIG.tickHz);

  let gold = state.gold;
  let chipSold = state.chipSold;
  const nextCargo: Cargo[] = [];
  const backlog: Record<string, Record<string, number>> = {};
  for (const [k, v] of Object.entries(state.converterBacklog)) backlog[k] = { ...v };
  const storage: Record<string, Record<string, number>> = {};
  for (const [k, v] of Object.entries(state.storage)) storage[k] = { ...v };
  const exporterProgress: Record<string, number> = { ...state.exporterProgress };

  const sell = (resource: string, exporterId: string): void => {
    gold += effectivePrice(resource, state.exporterLevel[exporterId] ?? 1);
    if (resource === 'chip') chipSold += 1;
    exporterProgress[exporterId] = (exporterProgress[exporterId] ?? 0) + 1;
  };

  const addBacklog = (convId: string, resource: string): void => {
    const b = backlog[convId] ?? (backlog[convId] = {});
    b[resource] = (b[resource] ?? 0) + 1;
  };
  const storageCount = (id: string): number =>
    Object.values(storage[id] ?? {}).reduce((a, b) => a + b, 0);
  const storageFull = (id: string): boolean =>
    storageCount(id) >= storageCap(state.storageLevel[id] ?? 1);
  const addStorage = (id: string, resource: string): void => {
    const b = storage[id] ?? (storage[id] = {});
    b[resource] = (b[resource] ?? 0) + 1;
  };

  // 소스가 자원 1개를 종착으로 내보낸다. 경유 컨베이어가 있으면 cargo 로 띄운다.
  // 반환: 실제로 배출됐는가 (Storage 만차면 false)
  const emit = (sourceId: string, resource: string, route: Route): boolean => {
    if (route.path.length > 1) {
      nextCargo.push({ resource, sourceId, index: 0, ticksOnTile: 0 });
      return true;
    }
    // 종착에 직접 인접 (경유 컨베이어 0칸)
    if (route.sink === 'exporter' && route.sinkId) {
      sell(resource, route.sinkId);
      return true;
    }
    if (route.sink === 'converter' && route.sinkId) {
      addBacklog(route.sinkId, resource);
      return true;
    }
    if (route.sink === 'storage' && route.sinkId) {
      if (storageFull(route.sinkId)) return false;
      addStorage(route.sinkId, resource);
      return true;
    }
    return false; // blocked
  };

  // 1) 이동 중인 자원 전진
  for (const c of state.cargo) {
    const route = routes.get(c.sourceId);
    if (!route || route.sink === 'blocked') continue; // 연결 끊김 → 소멸
    if (frozen.has(c.sourceId)) {
      nextCargo.push(c); // 정지된 공장 — 그대로 유지
      continue;
    }
    const path = route.path;
    if (c.index >= path.length - 1) continue; // 방어 (경로 짧아짐)

    const t = c.ticksOnTile + 1;
    if (t < perTile) {
      nextCargo.push({ ...c, ticksOnTile: t });
      continue;
    }
    const nextIndex = c.index + 1;
    if (nextIndex < path.length - 1) {
      nextCargo.push({ ...c, index: nextIndex, ticksOnTile: 0 });
      continue;
    }
    // 다음 칸이 종착 sink
    if (route.sink === 'exporter' && route.sinkId) {
      sell(c.resource, route.sinkId);
    } else if (route.sink === 'converter' && route.sinkId) {
      addBacklog(route.sinkId, c.resource);
    } else if (route.sink === 'storage' && route.sinkId) {
      if (storageFull(route.sinkId)) {
        nextCargo.push({ ...c, ticksOnTile: perTile }); // 만차 → 벨트 끝에서 대기
      } else {
        addStorage(route.sinkId, c.resource);
      }
    }
  }

  // 2) Node 생산
  const nodeCooldown: Record<string, number> = {};
  for (const p of state.placeables) {
    if (p.kind !== 'node') continue;
    if (frozen.has(p.id)) {
      nodeCooldown[p.id] = state.nodeCooldown[p.id] ?? 0; // 정지 — 쿨다운도 멈춤
      continue;
    }
    const cd = (state.nodeCooldown[p.id] ?? 0) - 1;
    const route = routes.get(p.id);
    if (cd <= 0 && route && route.sink !== 'blocked' && emit(p.id, p.resource, route)) {
      const grade = nodeGrade(p.resource, state.nodeLevel[p.id] ?? 1);
      nodeCooldown[p.id] = gradeToTicks(grade, CONFIG.tickHz);
    } else {
      nodeCooldown[p.id] = Math.max(0, cd);
    }
  }

  // 3) Converter 가공
  const converterCooldown: Record<string, number> = {};
  for (const p of state.placeables) {
    if (p.kind !== 'converter') continue;
    const isShut = shut.has(p.id);
    if (frozen.has(p.id) && !isShut) {
      converterCooldown[p.id] = state.converterCooldown[p.id] ?? 0; // 상류가 셧다운 → 완전 정지
      continue;
    }

    const cd = (state.converterCooldown[p.id] ?? 0) - 1;
    if (cd > 0) {
      converterCooldown[p.id] = cd;
      continue;
    }

    const bl = backlog[p.id] ?? {};
    const have = Object.keys(bl).filter((r) => (bl[r] ?? 0) > 0);
    const recipe = findRecipe(have);
    const outRoute = routes.get(p.id)!; // computeRoutes 가 모든 Converter 를 넣음

    if (recipe && recipe.inputs.every((i) => (bl[i] ?? 0) > 0)) {
      const outBlocked =
        outRoute.sink === 'blocked' ||
        (outRoute.sink === 'storage' && !!outRoute.sinkId && storageFull(outRoute.sinkId));
      if (outBlocked) {
        converterCooldown[p.id] = 0; // 출력 막힘 → 재고 유지하고 대기
        continue;
      }
      for (const i of recipe.inputs) bl[i] -= 1;
      backlog[p.id] = bl;
      emit(p.id, recipe.output, outRoute);
      converterCooldown[p.id] = gradeToTicks(recipe.grade, CONFIG.tickHz);
    } else {
      converterCooldown[p.id] = 0; // 레시피 미충족 → 대기
    }
  }

  // 4) 재고 정리 (0 이하 / 빈 항목 제거)
  const converterBacklog: Record<string, Record<string, number>> = {};
  for (const [id, bl] of Object.entries(backlog)) {
    const trimmed: Record<string, number> = {};
    for (const [r, n] of Object.entries(bl)) if (n > 0) trimmed[r] = n;
    if (Object.keys(trimmed).length > 0) converterBacklog[id] = trimmed;
  }

  // 5) 자원 해금 — 누적 칩 판매가 한도에 도달하면 A1·A2 해금 (임시 대상, 실제 이름은 용어정리 확정 시)
  const unlockedResources =
    chipSold >= CONFIG.resourceUnlockChips && !state.unlockedResources.includes('A1')
      ? [...state.unlockedResources, 'A1', 'A2']
      : state.unlockedResources;

  // 6) Exporter 레벨업 — 누적 판매 수가 한도(base × 현재 레벨) 이상이면 레벨++ (초과분 이월)
  const exporterLevel: Record<string, number> = { ...state.exporterLevel };
  for (const exId of Object.keys(exporterProgress)) {
    let lvl = exporterLevel[exId] ?? 1;
    let prog = exporterProgress[exId];
    while (prog >= CONFIG.exporterLevelUpBase * lvl) {
      prog -= CONFIG.exporterLevelUpBase * lvl;
      lvl += 1;
    }
    exporterLevel[exId] = lvl;
    exporterProgress[exId] = prog;
  }

  return {
    ...state,
    tick: state.tick + 1,
    gold,
    chipSold,
    exporterLevel,
    exporterProgress,
    cargo: nextCargo,
    nodeCooldown,
    converterCooldown,
    converterBacklog,
    storage,
    unlockedResources,
  };
}

// ---- 배치 / 철거 (실패 시 한국어 사유 문자열 반환) --------------------------

export type PlaceResult = SimState | string;

const occupied = (state: SimState, tile: Tile): boolean =>
  placeableAt(state.placeables, tile) !== undefined;

// tile에 dir 방향으로 놓을 때, 바로 앞칸의 설치물이 나를 정반대로 마주보면 true.
function facesHeadOn(placeables: readonly Placeable[], tile: Tile, dir: Dir): boolean {
  const front = placeableAt(placeables, stepTile(tile, dir));
  if (!front || front.kind === 'exporter' || front.kind === 'storage') return false;
  return front.dir === DIR_OPP[dir];
}

const HEAD_ON_MSG = '마주보는 방향으로는 설치할 수 없습니다';

const NOT_OWNED_MSG = '소유하지 않은 구역입니다';

export function placeConveyor(state: SimState, tile: Tile, dir: Dir): PlaceResult {
  if (!inOwnedZone(state.ownedZones, tile)) return NOT_OWNED_MSG;
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
  if (!inOwnedZone(state.ownedZones, tile)) return NOT_OWNED_MSG;
  if (occupied(state, tile)) return '이미 설치물이 있습니다';
  if (kind === 'node' && !state.unlockedResources.includes(resource)) {
    return '해금되지 않은 자원입니다';
  }
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

export function placeConverter(state: SimState, tile: Tile, dir: Dir): PlaceResult {
  if (!inOwnedZone(state.ownedZones, tile)) return NOT_OWNED_MSG;
  if (occupied(state, tile)) return '이미 설치물이 있습니다';
  if (facesHeadOn(state.placeables, tile, dir)) return HEAD_ON_MSG;
  if (state.gold < CONFIG.converterCost) return `골드 부족 (필요 ${CONFIG.converterCost}G)`;
  return {
    ...state,
    gold: state.gold - CONFIG.converterCost,
    placeables: [
      ...state.placeables,
      { kind: 'converter', id: `conv-${tile[0]}-${tile[1]}`, tile, dir },
    ],
  };
}

export function placeStorage(state: SimState, tile: Tile): PlaceResult {
  if (!inOwnedZone(state.ownedZones, tile)) return NOT_OWNED_MSG;
  if (occupied(state, tile)) return '이미 설치물이 있습니다';
  if (state.gold < CONFIG.storageCost) return `골드 부족 (필요 ${CONFIG.storageCost}G)`;
  return {
    ...state,
    gold: state.gold - CONFIG.storageCost,
    placeables: [
      ...state.placeables,
      { kind: 'storage', id: `store-${tile[0]}-${tile[1]}`, tile },
    ],
  };
}

// 긴급 배출 (무료) — Converter 재고만 제거, 셧다운 즉시 해제 (Obsidian 조치 1)
export function ventConverter(state: SimState, tile: Tile): PlaceResult {
  const p = placeableAt(state.placeables, tile);
  if (!p || p.kind !== 'converter') return '컨버터가 아닙니다';
  if (!state.converterBacklog[p.id]) return '배출할 재고가 없습니다';
  const converterBacklog = { ...state.converterBacklog };
  delete converterBacklog[p.id];
  const converterCooldown = { ...state.converterCooldown };
  delete converterCooldown[p.id];
  return { ...state, converterBacklog, converterCooldown };
}

// 다음 구역 확장 비용 = base × 현재 소유 구역 수 (선형 임시, 실제 지수곡선은 밸런싱 때).
// ponytail: 선형 근사 — Obsidian 공식은 base × 성장률^(n-1).
export function zoneCost(state: SimState): number {
  return CONFIG.zoneCostBase * state.ownedZones.length;
}

// 확장 구역 구매 — 소유 구역과 변이 맞닿은 구역만. 코너는 인접 팔을 먼저 사야 가능(구조로 강제).
export function buyZone(state: SimState, zoneId: string): PlaceResult {
  if (state.ownedZones.includes(zoneId)) return '이미 소유한 구역입니다';
  if (!buyableZones(state.ownedZones).includes(zoneId)) return '인접한 구역이 아닙니다';
  const cost = zoneCost(state);
  if (state.gold < cost) return `골드 부족 (필요 ${cost}G)`;
  return { ...state, gold: state.gold - cost, ownedZones: [...state.ownedZones, zoneId] };
}

// ---- M3-B 설비 업그레이드 (골드 + Storage 에서 재료 인출) ------------------

// 모든 Storage 를 통틀어 특정 자원 보유량
function totalInStorage(storage: StorageMap, resource: string): number {
  let n = 0;
  for (const b of Object.values(storage)) n += b[resource] ?? 0;
  return n;
}

// Storage 들에서 qty 만큼 자원을 뺀 새 맵 (앞 Storage 부터 소진)
function withdrawFromStorage(
  storage: StorageMap,
  resource: string,
  qty: number,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  let remaining = qty;
  for (const [id, b] of Object.entries(storage)) {
    const copy: Record<string, number> = { ...b };
    const have = copy[resource] ?? 0;
    if (remaining > 0 && have > 0) {
      const take = Math.min(remaining, have);
      remaining -= take;
      if (have - take > 0) copy[resource] = have - take;
      else delete copy[resource];
    }
    out[id] = copy;
  }
  return out;
}

export type UpgradeCost = { gold: number; material: string; materialQty: number };

// tile 설비의 다음 레벨업 비용 (Node/Storage 만). Exporter 는 자동 레벨업이라 대상 아님.
export function upgradeCost(state: SimState, tile: Tile): UpgradeCost | null {
  const p = placeableAt(state.placeables, tile);
  if (!p || (p.kind !== 'node' && p.kind !== 'storage')) return null;
  const level = (p.kind === 'node' ? state.nodeLevel : state.storageLevel)[p.id] ?? 1;
  return {
    gold: CONFIG.upgradeCostBase * level,
    material: CONFIG.upgradeMaterial,
    materialQty: CONFIG.upgradeMaterialPerLevel * level,
  };
}

// 설비 업그레이드 — 골드 + Storage 에 쌓인 재료 소모, 레벨 +1
export function upgradePlaceable(state: SimState, tile: Tile): PlaceResult {
  const p = placeableAt(state.placeables, tile);
  if (!p) return '설치물이 없습니다';
  if (p.kind === 'exporter') return 'Exporter 는 자동 레벨업입니다';
  if (p.kind !== 'node' && p.kind !== 'storage') return '업그레이드할 수 없는 설비입니다';

  const cost = upgradeCost(state, tile)!;
  if (state.gold < cost.gold) return `골드 부족 (필요 ${cost.gold}G)`;
  const have = totalInStorage(state.storage, cost.material);
  if (have < cost.materialQty) {
    const name = RESOURCES[cost.material]?.name ?? cost.material;
    return `${name} 부족 (필요 ${cost.materialQty}, 보유 ${have}) — Storage 에 모아야 함`;
  }

  const levels = p.kind === 'node' ? state.nodeLevel : state.storageLevel;
  const nextLevels = { ...levels, [p.id]: (levels[p.id] ?? 1) + 1 };
  const base: SimState = {
    ...state,
    gold: state.gold - cost.gold,
    storage: withdrawFromStorage(state.storage, cost.material, cost.materialQty),
  };
  return p.kind === 'node'
    ? { ...base, nodeLevel: nextLevels }
    : { ...base, storageLevel: nextLevels };
}

// 철거비 = 해당 설치물의 설치 비용과 동일 (Obsidian: "철거 비용은 설치 비용과 동일"). 임시 =10.
function removalFee(kind: Placeable['kind']): number {
  switch (kind) {
    case 'conveyor':
      return CONFIG.conveyorCost;
    case 'converter':
      return CONFIG.converterCost;
    case 'storage':
      return CONFIG.storageCost;
    default:
      return CONFIG.buildingCost;
  }
}

export function removePlaceable(state: SimState, tile: Tile): PlaceResult {
  const p = placeableAt(state.placeables, tile);
  if (!p) return '설치물이 없습니다';

  const fee = removalFee(p.kind);
  if (state.gold < fee) return `골드 부족 (철거비 ${fee}G)`;

  const placeables = state.placeables.filter((x) => x.id !== p.id);
  const cargo = state.cargo.filter((c) => c.sourceId !== p.id);
  const nodeCooldown = { ...state.nodeCooldown };
  delete nodeCooldown[p.id];
  const converterCooldown = { ...state.converterCooldown };
  delete converterCooldown[p.id];
  const converterBacklog = { ...state.converterBacklog };
  delete converterBacklog[p.id];
  const storage = { ...state.storage };
  delete storage[p.id];
  const nodeLevel = { ...state.nodeLevel };
  delete nodeLevel[p.id];
  const storageLevel = { ...state.storageLevel };
  delete storageLevel[p.id];
  const exporterLevel = { ...state.exporterLevel };
  delete exporterLevel[p.id];
  const exporterProgress = { ...state.exporterProgress };
  delete exporterProgress[p.id];

  return {
    ...state,
    gold: state.gold - fee,
    placeables,
    cargo,
    nodeCooldown,
    converterCooldown,
    converterBacklog,
    storage,
    nodeLevel,
    storageLevel,
    exporterLevel,
    exporterProgress,
  };
}
