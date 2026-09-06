import { describe, it, expect } from 'vitest';
import { gradeToSeconds } from '../src/data/speed';
import {
  initialState,
  step,
  findPath,
  placeConveyor,
  removePlaceable,
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
    // [3,4]만 북쪽으로 → Node의 동쪽 진행이 위로 꺾여 Exporter[6,4]에 못 감
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
    // [3,4]가 동쪽(→)을 향하는데 [4,4]에 서쪽(←)을 놓으려 하면 거부
    expect(placeConveyor(s, [4, 4], 'W')).toBe('마주보는 방향으로는 설치할 수 없습니다');
    // 같은 방향(→)은 허용
    expect(typeof placeConveyor(s, [4, 4], 'E')).not.toBe('string');
  });

  it('각 컨베이어의 방향을 따라 꺾이며 Exporter까지 경로를 찾는다', () => {
    // 자동 방향 지정 없음 — 각 타일이 자기 방향을 갖고, 그 결과로 꺾임
    const node = { kind: 'node', id: 'n', resource: 'chip', tile: [0, 0], dir: 'E' } as const;
    const ps = [
      node,
      { kind: 'conveyor', id: 'c1', tile: [1, 0], dir: 'E' } as const,
      { kind: 'conveyor', id: 'c2', tile: [2, 0], dir: 'S' } as const, // 아래로 꺾임
      { kind: 'conveyor', id: 'c3', tile: [2, 1], dir: 'S' } as const,
      { kind: 'exporter', id: 'e', tile: [2, 2] } as const,
    ];
    const path = findPath(ps, node);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(4); // c1, c2, c3, exporter
    expect(path![path!.length - 1]).toEqual([2, 2]);
  });
});

describe('철거 (Obsidian: 철거비 = 설치비, 임시 10G)', () => {
  it('시작 Node/Exporter도 철거 대상 — 단 철거비 필요', () => {
    const s = initialState(); // 골드 0
    expect(removePlaceable(s, [2, 4])).toBe('골드 부족 (철거비 10G)'); // node-1
    expect(removePlaceable(s, [6, 4])).toBe('골드 부족 (철거비 10G)'); // exporter-1
  });

  it('골드가 있으면 철거되고 철거비만큼 차감', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 300; i++) s = step(s);
    const before = s.gold;
    const r = removePlaceable(s, [4, 4]); // 가운데 컨베이어
    if (typeof r === 'string') throw new Error(r);
    expect(r.gold).toBe(before - 10);
    expect(r.placeables.some((p) => p.kind === 'conveyor' && p.tile[0] === 4)).toBe(false);
  });

  it('없는 타일 철거는 실패', () => {
    expect(removePlaceable(initialState(), [0, 0])).toBe('설치물이 없습니다');
  });
});
