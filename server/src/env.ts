// 필수 환경변수 읽기 — 없으면 부팅 시점에 즉시 실패.
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 미설정 — server/.env 를 확인하세요`);
  return v;
}
