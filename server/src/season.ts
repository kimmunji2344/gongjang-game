// 시즌 = 달력 월 단위(KST). 서버 스케줄러/크론 없이 "지금 몇 월인가"만 계산 — 매월 1일 0시(KST)에 자동 전환.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function currentSeasonId(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
