import { describe, it, expect } from 'vitest';
import { gradeToSeconds } from '../src/data/speed';
import { RESOURCES } from '../src/data/resources';
import { findRecipe } from '../src/data/recipes';
import {
  initialState,
  step,
  findPath,
  placeConveyor,
  placeBuilding,
  placeConverter,
  placeStorage,
  removePlaceable,
  ventConverter,
  shutdownSet,
  shutdownInfo,
  normalizeState,
  PlaceResult,
  SimState,
} from '../src/sim/sim';

// 시작 킷: 칩 Node[2,4]는 동쪽을 향함 → 컨베이어 3칸을 모두 동쪽(E)으로 이어 Exporter[6,4]에 연결
const connectStartKit = (start: SimState): SimState => {
  let s = start;
  for (const x of [3, 4, 5]) {
    const r = placeConveyor(s, [x, 4], 'E');
    if (typeof r === 'string') throw new Error(r);
    s = r;
  }
  return s;
};

// PlaceResult 를 성공으로 강제 (실패 시 사유를 던짐)
const ok = (r: PlaceResult): SimState => {
  if (typeof r === 'string') throw new Error(r);
  return r;
};

describe('속도 등급 매핑 (Obsidian 2026-09-06)', () => {
  it('1~9등급은 0.1초 단위', () => {
    expect(gradeToSeconds(1)).toBeCloseTo(0.1);
    expect(gradeToSeconds(9)).toBeCloseTo(0.9);
  });
  it('10~29등급은 (등급-9)초', () => {
    expect(gradeToSeconds(10)).toBe(1);
    expect(gradeToSeconds(29)).toBe(20);
  });
  it('30등급은 25초', () => {
    expect(gradeToSeconds(30)).toBe(25);
  });
  it('범위 밖은 에러', () => {
    expect(() => gradeToSeconds(0)).toThrow();
    expect(() => gradeToSeconds(31)).toThrow();
  });
});

describe('M1 코어 루프', () => {
  it('시작 상태: Node 미연결, 골드 0, 무료 컨베이어 3', () => {
    const s = initialState();
    const node = s.placeables.find((p) => p.kind === 'node')!;
    expect(findPath(s.placeables, node)).toBeNull();
    expect(s.gold).toBe(0);
    expect(s.freeConveyors).toBe(3);
  });

  it('무료 컨베이어 3개로 Node-Exporter 연결 (골드 차감 없음)', () => {
    const s = connectStartKit(initialState());
    const node = s.placeables.find((p) => p.kind === 'node')!;
    expect(findPath(s.placeables, node)).not.toBeNull();
    expect(s.freeConveyors).toBe(0);
    expect(s.gold).toBe(0);
  });

  it('연결 후 틱을 돌리면 골드가 판매가(10G) 배수로 증가', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 300; i++) s = step(s);
    expect(s.gold).toBeGreaterThan(0);
    expect(s.gold % 10).toBe(0);
  });

  it('무료 소진 + 골드 부족 시 컨베이어 설치 실패', () => {
    const s = connectStartKit(initialState());
    expect(placeConveyor(s, [3, 3], 'E')).toBe('골드 부족 (필요 10G)');
  });

  it('골드가 쌓이면 추가 컨베이어 설치 성공', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 300; i++) s = step(s);
    expect(typeof placeConveyor(s, [3, 3], 'E')).not.toBe('string');
  });
});

describe('컨베이어 방향 규칙 (Obsidian 2026-09-06)', () => {
  it('시작 Node는 동쪽 방향', () => {
    const node = initialState().placeables.find((p) => p.kind === 'node')!;
    expect(node.kind === 'node' && node.dir).toBe('E');
  });

  it('방향이 안 맞으면 Exporter에 도달 못 함 (연결 안 됨)', () => {
    let s = initialState();
    for (const [x, d] of [
      [3, 'N'],
      [4, 'E'],
      [5, 'E'],
    ] as const) {
      const r = placeConveyor(s, [x, 4], d);
      if (typeof r === 'string') throw new Error(r);
      s = r;
    }
    const node = s.placeables.find((p) => p.kind === 'node')!;
    expect(findPath(s.placeables, node)).toBeNull();
  });

  it('마주보는 방향(→ ←)으로는 인접 설치 불가', () => {
    const s = placeConveyor(initialState(), [3, 4], 'E');
    if (typeof s === 'string') throw new Error(s);
    expect(placeConveyor(s, [4, 4], 'W')).toBe('마주보는 방향으로는 설치할 수 없습니다');
    expect(typeof placeConveyor(s, [4, 4], 'E')).not.toBe('string');
  });

  it('각 컨베이어의 방향을 따라 꺾이며 Exporter까지 경로를 찾는다', () => {
    const node = { kind: 'node', id: 'n', resource: 'chip', tile: [0, 0], dir: 'E' } as const;
    const ps = [
      node,
      { kind: 'conveyor', id: 'c1', tile: [1, 0], dir: 'E' } as const,
      { kind: 'conveyor', id: 'c2', tile: [2, 0], dir: 'S' } as const,
      { kind: 'conveyor', id: 'c3', tile: [2, 1], dir: 'S' } as const,
      { kind: 'exporter', id: 'e', tile: [2, 2] } as const,
    ];
    const path = findPath(ps, node);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(4);
    expect(path![path!.length - 1]).toEqual([2, 2]);
  });
});

describe('철거 (Obsidian: 철거비 = 설치비, 임시 10G)', () => {
  it('시작 Node/Exporter도 철거 대상 — 단 철거비 필요', () => {
    const s = initialState();
    expect(removePlaceable(s, [2, 4])).toBe('골드 부족 (철거비 10G)');
    expect(removePlaceable(s, [6, 4])).toBe('골드 부족 (철거비 10G)');
  });

  it('골드가 있으면 철거되고 철거비만큼 차감', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 300; i++) s = step(s);
    const before = s.gold;
    const r = removePlaceable(s, [4, 4]);
    if (typeof r === 'string') throw new Error(r);
    expect(r.gold).toBe(before - 10);
    expect(r.placeables.some((p) => p.kind === 'conveyor' && p.tile[0] === 4)).toBe(false);
  });

  it('없는 타일 철거는 실패', () => {
    expect(removePlaceable(initialState(), [0, 0])).toBe('설치물이 없습니다');
  });
});

// ---- M2: 가공 · 저장 · 셧다운 -------------------------------------------------

describe('M2 레시피 매칭', () => {
  it('입력이 전부 갖춰진 레시피를 찾는다', () => {
    expect(findRecipe(['A1', 'A2'])?.id).toBe('R1'); // A1+A2 → B1
    expect(findRecipe(['A1', 'B1'])?.id).toBe('R2'); // R1 은 A2 부족 → R2 (A1+B1 → C1)
  });
  it('입력이 모자라면 null', () => {
    expect(findRecipe(['A1'])).toBeNull();
    expect(findRecipe([])).toBeNull();
  });
});

// A1 Node[1,1]↓ → 컨베이어[1,2]↓ → Converter[1,3](출력→) ,  A2 Node[1,5]↑ → 컨베이어[1,4]↑ → Converter[1,3]
// Converter 출력 → 컨베이어[2,3]→ → Exporter[3,3]
const converterRig = (): SimState => {
  let s: SimState = { ...initialState(), gold: 100000 };
  s = ok(placeBuilding(s, 'node', [1, 1], 'A1', 'S'));
  s = ok(placeConveyor(s, [1, 2], 'S'));
  s = ok(placeConverter(s, [1, 3], 'E'));
  s = ok(placeBuilding(s, 'node', [1, 5], 'A2', 'N'));
  s = ok(placeConveyor(s, [1, 4], 'N'));
  s = ok(placeConveyor(s, [2, 3], 'E'));
  s = ok(placeBuilding(s, 'exporter', [3, 3]));
  return s;
};

describe('M2 Converter 가공', () => {
  it('A1 + A2 → B1 을 가공해 Exporter 로 판매한다', () => {
    let s = converterRig();
    const before = s.gold;
    for (let i = 0; i < 300; i++) s = step(s);
    expect(s.gold).toBeGreaterThan(before); // B1 이 팔림
    expect((s.gold - before) % RESOURCES.B1.sellPrice).toBe(0);
  });

  it('재귀 가공: 재고 {A1, B1} → C1 산출 후 판매 (Converter → Exporter)', () => {
    let s: SimState = {
      ...initialState(),
      gold: 0,
      placeables: [
        { kind: 'converter', id: 'c', tile: [1, 1], dir: 'E' },
        { kind: 'conveyor', id: 'cv', tile: [2, 1], dir: 'E' },
        { kind: 'exporter', id: 'ex', tile: [3, 1] },
      ],
      converterBacklog: { c: { A1: 1, B1: 1 } },
    };
    for (let i = 0; i < 40; i++) s = step(s);
    expect(s.gold).toBe(RESOURCES.C1.sellPrice);
    expect(s.converterBacklog.c).toBeUndefined(); // 재고 소진
  });
});

describe('M2 Storage', () => {
  it('용량까지만 채우고 초과분은 벨트에서 대기', () => {
    let s: SimState = { ...initialState(), gold: 100000 };
    s = ok(placeBuilding(s, 'node', [1, 1], 'A1', 'S'));
    s = ok(placeConveyor(s, [1, 2], 'S'));
    s = ok(placeConveyor(s, [1, 3], 'S'));
    s = ok(placeStorage(s, [1, 4]));
    for (let i = 0; i < 400; i++) s = step(s);
    expect(s.storage['store-1-4']).toBe(10); // CONFIG.storageCapacity
    expect(s.cargo.length).toBeGreaterThan(0); // 만차 → 초과분 벨트 대기
  });
});

describe('M2 셧다운 (재고 무게 기반) + 긴급 배출', () => {
  // A1 만 공급되는 Converter — R1(A1+A2)/R2(A1+B1) 어느 것도 못 돌려 재고가 쌓임
  const jamRig = (): SimState => {
    let s: SimState = { ...initialState(), gold: 100000 };
    s = ok(placeBuilding(s, 'node', [1, 1], 'A1', 'S'));
    s = ok(placeConveyor(s, [1, 2], 'S'));
    s = ok(placeConverter(s, [1, 3], 'E'));
    return s;
  };

  it('재고 무게가 한도에 도달하면 셧다운되고 상류 Node 가 멈춘다', () => {
    let s = jamRig();
    for (let i = 0; i < 80; i++) s = step(s);
    expect(shutdownSet(s).has('conv-1-3')).toBe(true);
    expect(Object.keys(shutdownInfo(s))).toEqual(['conv-1-3']);
    // 셧다운 후 상류가 얼어 재고가 더 늘지 않음 (weight 10 = 한도, A1 한 단위)
    expect(s.converterBacklog['conv-1-3'].A1).toBe(1);
  });

  it('긴급 배출로 재고를 비우면 즉시 셧다운이 풀린다', () => {
    let s = jamRig();
    for (let i = 0; i < 80; i++) s = step(s);
    const vented = ok(ventConverter(s, [1, 3]));
    expect(shutdownSet(vented).size).toBe(0);
    expect(vented.converterBacklog['conv-1-3']).toBeUndefined();
    // 재고 없는 Converter 에 긴급 배출 → 실패 메시지
    expect(ventConverter(vented, [1, 3])).toBe('배출할 재고가 없습니다');
  });
});

describe('M2 세이브 마이그레이션 (v1 → v2)', () => {
  it('normalizeState 가 신규 필드를 채우고 Cargo.nodeId 를 sourceId 로 옮긴다', () => {
    const v1 = {
      tick: 5,
      gold: 30,
      placeables: [],
      cargo: [{ resource: 'chip', nodeId: 'node-1', index: 0, ticksOnTile: 2 }],
      nodeCooldown: { 'node-1': 4 },
      freeConveyors: 0,
    } as unknown as SimState;
    const v2 = normalizeState(v1);
    expect(v2.converterBacklog).toEqual({});
    expect(v2.converterCooldown).toEqual({});
    expect(v2.storage).toEqual({});
    expect(v2.cargo[0].sourceId).toBe('node-1');
  });
});
