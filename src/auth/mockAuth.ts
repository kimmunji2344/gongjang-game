// M0 로컬 목업 인증. ⚠️ 실제 보안 아님 — localStorage 기반, 서버 없음.
// M4에서 이 파일을 실 Express(/api/auth/*) + bcrypt + JWT 호출로 교체한다 (함수 시그니처 유지).

import { checkId, checkPw } from '../data/authRules';

const USERS_KEY = 'gongjang_users';
const TOKEN_KEY = 'gongjang_token';
const MOCK_SALT = 'gongjang-m0-mock';           // M4 실서버에선 유저별 bcrypt salt
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7일

type UserRecord = { pwHash: string; createdAt: number };
type UserMap = Record<string, UserRecord>;

function readUsers(): UserMap {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}') as UserMap;
  } catch {
    return {};
  }
}

function writeUsers(users: UserMap): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function hash(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(MOCK_SALT + pw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type AuthResult = { ok: true } | { ok: false; error: string };

export function idExists(id: string): boolean {
  return id in readUsers();
}

// 회원가입 — 성공해도 자동 로그인 안 함 (Obsidian 명시)
export async function signUp(id: string, pw: string): Promise<AuthResult> {
  const ci = checkId(id);
  if (!ci.ok) return { ok: false, error: ci.msg };
  const cp = checkPw(pw);
  if (!cp.ok) return { ok: false, error: cp.msg };

  const users = readUsers();
  if (id in users) return { ok: false, error: '중복아이디입니다' };
  users[id] = { pwHash: await hash(pw), createdAt: Date.now() };
  writeUsers(users);
  return { ok: true };
}

// 로그인 — 실패 시 아이디/비번 중 어느 쪽인지 구분 안 함 (Obsidian: 계정 존재 여부 노출 방지)
export async function logIn(id: string, pw: string): Promise<AuthResult> {
  const generic = '아이디 또는 비밀번호가 일치하지 않습니다';
  const user = readUsers()[id];
  if (!user || user.pwHash !== (await hash(pw))) return { ok: false, error: generic };

  const token = btoa(JSON.stringify({ id, exp: Date.now() + TOKEN_TTL_MS }));
  localStorage.setItem(TOKEN_KEY, token);
  return { ok: true };
}

// 저장된 토큰이 유효하면 userId, 아니면 null (메뉴/로그인 생략 판단용)
export function session(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { id, exp } = JSON.parse(atob(raw)) as { id: string; exp: number };
    if (typeof exp !== 'number' || Date.now() > exp) return null;
    return idExists(id) ? id : null;
  } catch {
    return null;
  }
}

export function logOut(): void {
  localStorage.removeItem(TOKEN_KEY);
}
