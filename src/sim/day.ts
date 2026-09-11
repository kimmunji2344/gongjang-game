// 오늘 날짜(KST) 문자열 — NPC 하루 리셋 판정용. sim.ts 는 순수함수 유지를 위해
// Date 를 직접 읽지 않고, 호출부(FactoryScene)가 이 값을 계산해 인자로 넘긴다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function currentDayId(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
