import { describe, it, expect } from 'vitest';
import { gradeToSeconds } from '../src/data/speed';
import { initialState, step, findPath, placeConveyor, SimState } from '../src/sim/sim';

const connectStartKit = (start: SimState): SimState => {
  let s = start;
  for (const x of [3, 4, 5]) {
    const r = placeConveyor(s, [x, 4]);
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
    expect(placeConveyor(s, [3, 3])).toBe('골드 부족 (필요 10G)');
  });

  it('골드가 쌓이면 추가 컨베이어 설치 성공', () => {
    let s = connectStartKit(initialState());
    for (let i = 0; i < 300; i++) s = step(s);
    expect(typeof placeConveyor(s, [3, 3])).not.toBe('string');
  });
});
