import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/data/config';
import { gradeToSeconds } from '../src/data/speed';
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
  buyZone,
  zoneCost,
  upgradePlaceable,
  upgradeCost,
  effectivePrice,
  nodeGrade,
  storageCap,
  storageTotal,
  shutdownSet,
  shutdownInfo,
  normalizeState,
  refreshNpcQuest,
  fulfillNpcQuest,
  checkHint,
  totalInStorage,
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

  it('연결 후 틱을 돌리면 판매로 골드가 쌓인다 (칩 최소 10G/개)', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 100; i++) s = step(s);
    expect(s.chipSold).toBeGreaterThan(0);
    // M3-B: Exporter 레벨/tier 로 개당 판매가가 10 이상으로 오를 수 있음
    expect(s.gold).toBeGreaterThanOrEqual(s.chipSold * 10);
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
  let s: SimState = {
    ...initialState(),
    gold: 100000,
    unlockedResources: ['chip', 'A1', 'A2'], // M2 픽스처는 해금 상태 가정
  };
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
    // B1(tier 1) 이 팔림 → 개당 최소 effectivePrice(B1, 1) = 15G
    expect(s.gold - before).toBeGreaterThanOrEqual(effectivePrice('B1', 1));
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
    expect(s.gold).toBe(effectivePrice('C1', 1)); // C1(tier 2) 1개 판매 = 20G
    expect(s.converterBacklog.c).toBeUndefined(); // 재고 소진
  });
});

describe('M2 Storage', () => {
  it('용량까지만 채우고 초과분은 벨트에서 대기', () => {
    let s: SimState = {
    ...initialState(),
    gold: 100000,
    unlockedResources: ['chip', 'A1', 'A2'], // M2 픽스처는 해금 상태 가정
  };
    s = ok(placeBuilding(s, 'node', [1, 1], 'A1', 'S'));
    s = ok(placeConveyor(s, [1, 2], 'S'));
    s = ok(placeConveyor(s, [1, 3], 'S'));
    s = ok(placeStorage(s, [1, 4]));
    for (let i = 0; i < 400; i++) s = step(s);
    expect(storageTotal(s, 'store-1-4')).toBe(10); // CONFIG.storageCapacity (레벨 1)
    expect(s.storage['store-1-4'].A1).toBe(10); // 자원별로 보관
    expect(s.cargo.length).toBeGreaterThan(0); // 만차 → 초과분 벨트 대기
  });
});

describe('M2 셧다운 (재고 무게 기반) + 긴급 배출', () => {
  // A1 만 공급되는 Converter — R1(A1+A2)/R2(A1+B1) 어느 것도 못 돌려 재고가 쌓임
  const jamRig = (): SimState => {
    let s: SimState = {
    ...initialState(),
    gold: 100000,
    unlockedResources: ['chip', 'A1', 'A2'], // M2 픽스처는 해금 상태 가정
  };
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

// ---- M3-A: 확장 구역 · 자원 해금 ------------------------------------------------

describe('M3-A 확장 구역', () => {
  it('시작: 중앙 구역만 소유, 자원은 칩만 해금', () => {
    const s = initialState();
    expect(s.ownedZones).toEqual(['0,0']);
    expect(s.unlockedResources).toEqual(['chip']);
    expect(zoneCost(s)).toBe(10); // 10 × 소유 1개
  });

  it('인접 팔 구역 구매 — 비용 = 10 × 소유 구역 수, 골드 차감', () => {
    let s: SimState = { ...initialState(), gold: 100 };
    const r = buyZone(s, '1,0'); // 동쪽 팔
    if (typeof r === 'string') throw new Error(r);
    s = r;
    expect(s.ownedZones).toContain('1,0');
    expect(s.gold).toBe(90); // 첫 구매 10
    expect(zoneCost(s)).toBe(20); // 다음 구매 10 × 2
  });

  it('코너 구역은 인접 팔을 먼저 사야 구매 가능', () => {
    let s: SimState = { ...initialState(), gold: 1000 };
    expect(buyZone(s, '1,1')).toBe('인접한 구역이 아닙니다'); // 중앙과 변이 안 닿음
    s = buyZone(s, '1,0') as SimState;
    s = buyZone(s, '0,1') as SimState;
    expect(typeof buyZone(s, '1,1')).not.toBe('string'); // 팔 2개 확보 → 코너 가능
  });

  it('골드 부족 / 이미 소유 / 범위 밖 구매 거부', () => {
    expect(buyZone({ ...initialState(), gold: 5 }, '1,0')).toBe('골드 부족 (필요 10G)');
    expect(buyZone({ ...initialState(), gold: 100 }, '0,0')).toBe('이미 소유한 구역입니다');
    expect(buyZone({ ...initialState(), gold: 100 }, '2,0')).toBe('인접한 구역이 아닙니다'); // 3×3 밖
  });

  it('소유하지 않은 구역엔 설치 불가, 구매 후 가능', () => {
    let s: SimState = { ...initialState(), gold: 100 };
    expect(placeConveyor(s, [12, 4], 'E')).toBe('소유하지 않은 구역입니다'); // 동쪽 팔 타일
    s = buyZone(s, '1,0') as SimState;
    expect(typeof placeConveyor(s, [12, 4], 'E')).not.toBe('string');
  });
});

describe('M3-A 자원 해금 (칩 판매)', () => {
  it('해금 전에는 A1 배치 불가', () => {
    const s: SimState = { ...initialState(), gold: 100 };
    expect(placeBuilding(s, 'node', [1, 1], 'A1', 'S')).toBe('해금되지 않은 자원입니다');
  });

  it('칩 누적 판매가 한도 도달 → A1·A2 해금 → 배치 가능', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 500 && !s.unlockedResources.includes('A1'); i++) s = step(s);
    expect(s.chipSold).toBeGreaterThanOrEqual(CONFIG.resourceUnlockChips);
    expect(s.unlockedResources).toEqual(['chip', 'A1', 'A2']);
    expect(typeof placeBuilding({ ...s, gold: 100 }, 'node', [1, 1], 'A1', 'S')).not.toBe('string');
  });
});

describe('M3-A 세이브 마이그레이션 (v2 → v3)', () => {
  it('normalizeState 가 구역/해금 필드를 채운다', () => {
    const v2 = {
      tick: 1,
      gold: 0,
      placeables: [],
      cargo: [],
      nodeCooldown: {},
      converterCooldown: {},
      converterBacklog: {},
      storage: {},
      freeConveyors: 0,
    } as unknown as SimState;
    const v3 = normalizeState(v2);
    expect(v3.ownedZones).toEqual(['0,0']);
    expect(v3.unlockedResources).toEqual(['chip']);
    expect(v3.chipSold).toBe(0);
  });
});

// ---- M3-B: 레벨링 (업그레이드 · Exporter 레벨 · tier 판매가) --------------------

describe('M3-B tier 판매가 + Exporter 레벨 배율', () => {
  it('tier 높을수록 판매가 상승 (B1 ×1.5, C1 ×2)', () => {
    expect(effectivePrice('chip', 1)).toBe(10); // tier 0
    expect(effectivePrice('B1', 1)).toBe(15); // tier 1 → 10 × 1.5
    expect(effectivePrice('C1', 1)).toBe(20); // tier 2 → 10 × 2
  });
  it('Exporter 레벨당 판매 수익률 +10%', () => {
    expect(effectivePrice('chip', 2)).toBe(11);
    expect(effectivePrice('chip', 3)).toBe(12);
    expect(effectivePrice('B1', 2)).toBe(17); // round(10 × 1.5 × 1.1)
  });
});

describe('M3-B Exporter 자동 레벨업', () => {
  it('누적 판매가 한도(10×레벨)에 도달하면 자동 레벨업', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 400; i++) s = step(s);
    expect(s.exporterLevel['exporter-1']).toBeGreaterThanOrEqual(2);
  });
});

describe('M3-B Node 유효 등급 / Storage 용량', () => {
  it('nodeGrade: 레벨당 등급 -1, 등급 1 캡', () => {
    expect(nodeGrade('chip', 1)).toBe(10);
    expect(nodeGrade('chip', 2)).toBe(9);
    expect(nodeGrade('chip', 11)).toBe(1);
    expect(nodeGrade('chip', 30)).toBe(1);
  });
  it('storageCap: 레벨당 +10', () => {
    expect(storageCap(1)).toBe(10);
    expect(storageCap(2)).toBe(20);
    expect(storageCap(3)).toBe(30);
  });
});

describe('M3-B 설비 업그레이드 (골드 + Storage 재료)', () => {
  const rig = (): SimState => ({
    ...initialState(),
    gold: 1000,
    placeables: [
      { kind: 'node', id: 'n', resource: 'chip', tile: [1, 1], dir: 'E' },
      { kind: 'storage', id: 'st', tile: [3, 3] },
    ],
    storage: { st: { B1: 5 } },
  });

  it('Node 업그레이드 — 골드 + B1 소모, 레벨 +1', () => {
    const s = rig();
    expect(upgradeCost(s, [1, 1])).toEqual({ gold: 10, material: 'B1', materialQty: 1 });
    const r = upgradePlaceable(s, [1, 1]);
    if (typeof r === 'string') throw new Error(r);
    expect(r.nodeLevel['n']).toBe(2);
    expect(r.gold).toBe(990);
    expect(storageTotal(r, 'st')).toBe(4); // B1 1개 인출
  });

  it('Storage 업그레이드 — 용량 증가', () => {
    const r = upgradePlaceable(rig(), [3, 3]);
    if (typeof r === 'string') throw new Error(r);
    expect(r.storageLevel['st']).toBe(2);
    expect(storageCap(r.storageLevel['st'])).toBe(20);
  });

  it('골드 / 재료 부족 시 거부', () => {
    expect(upgradePlaceable({ ...rig(), gold: 5 }, [1, 1])).toBe('골드 부족 (필요 10G)');
    expect(upgradePlaceable({ ...rig(), storage: {} }, [1, 1])).toContain('부족');
  });

  it('Exporter 는 업그레이드 대상 아님 (자동 레벨업)', () => {
    const s: SimState = {
      ...initialState(),
      placeables: [{ kind: 'exporter', id: 'e', tile: [1, 1] }],
    };
    expect(upgradePlaceable(s, [1, 1])).toBe('Exporter 는 자동 레벨업입니다');
  });

  it('레벨 2 업그레이드 비용은 2배 (선형)', () => {
    const s = upgradePlaceable(rig(), [1, 1]) as SimState;
    expect(upgradeCost(s, [1, 1])).toEqual({ gold: 20, material: 'B1', materialQty: 2 });
  });
});

describe('M3-B Storage 자원별 보관', () => {
  it('서로 다른 자원 2종이 한 Storage 에 나뉘어 쌓임', () => {
    let s: SimState = {
      ...initialState(),
      gold: 100000,
      unlockedResources: ['chip', 'A1', 'A2'],
    };
    s = ok(placeBuilding(s, 'node', [1, 1], 'A1', 'E'));
    s = ok(placeConveyor(s, [2, 1], 'E'));
    s = ok(placeStorage(s, [3, 1]));
    s = ok(placeBuilding(s, 'node', [3, 3], 'A2', 'N'));
    s = ok(placeConveyor(s, [3, 2], 'N'));
    for (let i = 0; i < 300; i++) s = step(s);
    const bucket = s.storage['store-3-1'] ?? {};
    expect(bucket.A1).toBeGreaterThan(0);
    expect(bucket.A2).toBeGreaterThan(0);
    expect(storageTotal(s, 'store-3-1')).toBe(10); // 합계 = 용량(레벨 1)
  });
});

describe('M3-B 세이브 마이그레이션 (v3 → v4)', () => {
  it('storage 숫자 → 자원별 맵(내용 폐기), 레벨 필드 기본값', () => {
    const v3 = {
      tick: 1,
      gold: 0,
      placeables: [],
      cargo: [],
      nodeCooldown: {},
      converterCooldown: {},
      converterBacklog: {},
      storage: { 'store-1-1': 7 }, // v3: 숫자
      freeConveyors: 0,
      ownedZones: ['0,0'],
      unlockedResources: ['chip'],
      chipSold: 3,
    } as unknown as SimState;
    const v4 = normalizeState(v3);
    expect(v4.storage['store-1-1']).toEqual({}); // 자원 종류 미기록 → 폐기
    expect(v4.nodeLevel).toEqual({});
    expect(v4.exporterLevel).toEqual({});
    expect(v4.chipSold).toBe(3);
  });
});

describe('M5 총 수익 누적 (WAR 효율 계산용, 리셋 없는 평생 카운터)', () => {
  it('판매마다 totalRevenue 가 gold 와 함께 누적된다', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 100; i++) s = step(s);
    expect(s.totalRevenue).toBeGreaterThan(0);
    expect(s.totalRevenue).toBe(s.gold); // 지출이 없었으므로 누적 수익 = 현재 골드
  });
});

describe('M5 세이브 마이그레이션 (v4 → v5)', () => {
  it('normalizeState 가 totalRevenue 기본값 0 을 채운다', () => {
    const v4 = {
      tick: 1,
      gold: 50,
      placeables: [],
      cargo: [],
      nodeCooldown: {},
      converterCooldown: {},
      converterBacklog: {},
      storage: {},
      freeConveyors: 0,
      ownedZones: ['0,0'],
      unlockedResources: ['chip'],
      chipSold: 3,
      nodeLevel: {},
      storageLevel: {},
      exporterLevel: {},
      exporterProgress: {},
    } as unknown as SimState; // v4: totalRevenue 필드 없음
    const v5 = normalizeState(v4);
    expect(v5.totalRevenue).toBe(0);
  });
});

describe('M6 NPC 일일 퀘스트 (하루 1회, day 는 인자로 주입 — 순수함수)', () => {
  it('퀘스트가 없으면 오늘 날짜로 새로 발급', () => {
    const s = refreshNpcQuest(initialState(), '2026-09-12');
    expect(s.npc).not.toBeNull();
    expect(s.npc?.day).toBe('2026-09-12');
    expect(s.npc?.qty).toBe(CONFIG.npcQuestQty);
    expect(s.unlockedResources).toContain(s.npc?.resource);
  });

  it('같은 날짜면 재발급하지 않는다', () => {
    const s1 = refreshNpcQuest(initialState(), '2026-09-12');
    const s2 = refreshNpcQuest(s1, '2026-09-12');
    expect(s2.npc).toEqual(s1.npc);
  });

  it('날짜가 바뀌면 새 요청으로 교체된다(이월 없음)', () => {
    const s1 = refreshNpcQuest(initialState(), '2026-09-12');
    const s2 = refreshNpcQuest(s1, '2026-09-13');
    expect(s2.npc?.day).toBe('2026-09-13');
  });

  it('같은 날짜 입력은 항상 같은 자원을 고른다(결정론적, 랜덤 아님)', () => {
    const a = refreshNpcQuest(initialState(), '2026-09-12').npc?.resource;
    const b = refreshNpcQuest(initialState(), '2026-09-12').npc?.resource;
    expect(a).toBe(b);
  });
});

describe('M6 NPC 퀘스트 완료 (Storage 인출 + 보상, 기본가 × 수량 × 알파배수)', () => {
  const rig = (): SimState => ({
    ...refreshNpcQuest(initialState(), '2026-09-12'),
    storage: { st: { chip: 20 } },
  });

  it('보유량 충분하면 성공 — 골드/totalRevenue 지급, Storage 인출, npcQuestsDone +1, npc.done=true', () => {
    const s = rig();
    const { resource, qty } = s.npc!;
    const expectedReward = effectivePrice(resource, 1) * qty * CONFIG.npcAlphaMultiplier;
    const r = fulfillNpcQuest(s);
    if (typeof r === 'string') throw new Error(r);
    expect(r.gold).toBe(expectedReward);
    expect(r.totalRevenue).toBe(expectedReward);
    expect(r.npcQuestsDone).toBe(1);
    expect(r.npc?.done).toBe(true);
    expect(totalInStorage(r.storage, resource)).toBe(20 - qty);
  });

  it('보유량 부족하면 거부', () => {
    const s = { ...rig(), storage: { st: { chip: 1 } } };
    expect(typeof fulfillNpcQuest(s)).toBe('string');
  });

  it('오늘의 요청이 없으면 거부', () => {
    expect(fulfillNpcQuest(initialState())).toBe('오늘의 NPC 요청이 없습니다');
  });

  it('오늘 이미 완료했으면 재요청 거부(같은 날짜엔 refreshNpcQuest 로도 재발급되지 않음)', () => {
    const s = rig();
    const done = fulfillNpcQuest(s);
    if (typeof done === 'string') throw new Error(done);
    expect(fulfillNpcQuest(done)).toBe('오늘 요청은 이미 완료했습니다');
    const refreshed = refreshNpcQuest(done, done.npc!.day);
    expect(refreshed.npc).toEqual(done.npc); // 같은 날짜 — 재발급 안 됨
  });
});

describe('M6 자원 도감 — 생산 시 자동 등록', () => {
  it('Node 가 자원을 배출하면 codexResources 에 등록된다', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 20; i++) s = step(s);
    expect(s.codexResources).toContain('chip');
  });
});

describe('M6 업적 도감 — 지표 임계값 달성 시 등록', () => {
  it('누적수익 100 달성 시 sales_100 등록', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 2000 && s.totalRevenue < 100; i++) s = step(s);
    expect(s.totalRevenue).toBeGreaterThanOrEqual(100);
    expect(s.codexAchievements).toContain('sales_100');
  });

  it('구역 3개 보유 시 zones_3 등록', () => {
    const s = step({ ...initialState(), ownedZones: ['0,0', '0,-1', '0,1'] });
    expect(s.codexAchievements).toContain('zones_3');
  });
});

describe('M6 타일 도감(히든) — 정사각형 곳간 패턴', () => {
  it('Storage 4개를 2×2 로 인접 배치하면 발견된다', () => {
    let s: SimState = { ...initialState(), gold: 100000, placeables: [] };
    s = ok(placeStorage(s, [1, 1]));
    s = ok(placeStorage(s, [2, 1]));
    s = ok(placeStorage(s, [1, 2]));
    s = ok(placeStorage(s, [2, 2]));
    s = step(s);
    expect(s.codexTilePatterns).toContain('storage_square');
  });

  it('정사각형이 아니면 발견되지 않는다', () => {
    let s: SimState = { ...initialState(), gold: 100000, placeables: [] };
    s = ok(placeStorage(s, [1, 1]));
    s = ok(placeStorage(s, [3, 1]));
    s = step(s);
    expect(s.codexTilePatterns).not.toContain('storage_square');
  });
});

describe('M6 튜토리얼 힌트 — 평생 1회', () => {
  it('활성 상태면 힌트 id 를 반환하고 hintsSeen 에 등록, 이후엔 반환하지 않는다', () => {
    const [s1, hint1] = checkHint(initialState(), 'start', true);
    expect(hint1).toBe('start');
    expect(s1.hintsSeen).toContain('start');

    const [s2, hint2] = checkHint(s1, 'start', true);
    expect(hint2).toBeNull();
    expect(s2).toBe(s1); // 변화 없음 — 같은 참조 반환
  });

  it('비활성 상태면 등록도 반환도 하지 않는다', () => {
    const [s, hint] = checkHint(initialState(), 'shutdown', false);
    expect(hint).toBeNull();
    expect(s.hintsSeen).toEqual([]);
  });
});

describe('M6 세이브 마이그레이션 (v5 → v6)', () => {
  it('normalizeState 가 NPC/도감/힌트 필드 기본값을 채운다', () => {
    const v5 = {
      tick: 1,
      gold: 50,
      totalRevenue: 50,
      placeables: [],
      cargo: [],
      nodeCooldown: {},
      converterCooldown: {},
      converterBacklog: {},
      storage: {},
      freeConveyors: 0,
      ownedZones: ['0,0'],
      unlockedResources: ['chip'],
      chipSold: 3,
      nodeLevel: {},
      storageLevel: {},
      exporterLevel: {},
      exporterProgress: {},
    } as unknown as SimState; // v5: M6 필드 없음
    const v6 = normalizeState(v5);
    expect(v6.npc).toBeNull();
    expect(v6.npcQuestsDone).toBe(0);
    expect(v6.codexResources).toEqual([]);
    expect(v6.codexAchievements).toEqual([]);
    expect(v6.codexTilePatterns).toEqual([]);
    expect(v6.hintsSeen).toEqual([]);
  });
});
