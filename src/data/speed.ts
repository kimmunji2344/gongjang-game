// 속도 등급(1~30) → 처리 시간(초).
// 출처: Obsidian 공장게임.md > 시스템 설계 원칙 > 속도 시스템 (2026-09-06 갱신)
//   1~9 등급   : 등급 x 0.1초
//   10~29 등급 : (등급 - 9)초  → 1~20초
//   30 등급    : 25초 (가장 느린 구간)

export function gradeToSeconds(grade: number): number {
  if (!Number.isInteger(grade) || grade < 1 || grade > 30) {
    throw new Error(`속도 등급은 1~30 정수여야 함: ${grade}`);
  }
  if (grade <= 9) return grade * 0.1;
  if (grade <= 29) return grade - 9;
  return 25;
}

// 해당 등급의 1회 처리에 필요한 시뮬 틱 수 (최소 1틱)
export function gradeToTicks(grade: number, tickHz: number): number {
  return Math.max(1, Math.round(gradeToSeconds(grade) * tickHz));
}
