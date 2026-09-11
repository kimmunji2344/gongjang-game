// 서버 전용 provisional 수치 (사용자 규칙: 미확정 수치는 임시값 10). 클라 src/data/config.ts 와는 별개 관리.
export const SERVER_CONFIG = {
  tickHz: 10,         // 클라 CONFIG.tickHz 와 반드시 동일하게 유지할 것 (WAR 효율 = totalRevenue ÷ (tick/tickHz))
  rankPageSize: 10,   // 시즌 랭킹 조회 시 최대 반환 인원 (임시=10)
  hallOfFameSize: 10, // 시즌별 명예의 전당 보존 인원 (임시=10)
} as const;
