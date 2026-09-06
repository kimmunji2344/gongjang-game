// M4 실서버 인증 클라이언트. /api/auth/* HTTP 호출. (M0 mockAuth.ts 대체)
// UI(src/ui/screens.ts)는 이 모듈의 함수 시그니처에만 의존한다.

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'gongjang_token';

export type AuthResult = { ok: true } | { ok: false; error: string };

const CONN_ERR = '서버에 연결할 수 없습니다';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(t: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* localStorage 불가 — 세션 유지 안 되지만 치명적이지 않음 */
  }
}

export function logOut(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* no-op */
  }
}

async function postJson(
  path: string,
  body: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, data };
}

// 회원가입 — 성공해도 자동 로그인 안 함 (Obsidian 명시)
export async function signUp(id: string, pw: string): Promise<AuthResult> {
  try {
    const { status, data } = await postJson('/api/auth/signup', { id, pw });
    if (status === 200 && data.ok === true) return { ok: true };
    return {
      ok: false,
      error: typeof data.error === 'string' ? data.error : '회원가입에 실패했습니다',
    };
  } catch {
    return { ok: false, error: CONN_ERR };
  }
}

// 로그인 — 실패 시 아이디/비번 구분 안 함 (Obsidian: 계정 존재 여부 노출 방지)
export async function logIn(id: string, pw: string): Promise<AuthResult> {
  try {
    const { status, data } = await postJson('/api/auth/login', { id, pw });
    if (status === 200 && typeof data.token === 'string') {
      setToken(data.token);
      return { ok: true };
    }
    return {
      ok: false,
      error:
        typeof data.error === 'string' ? data.error : '아이디 또는 비밀번호가 일치하지 않습니다',
    };
  } catch {
    return { ok: false, error: CONN_ERR };
  }
}

// 회원가입 실시간 중복 확인용 (디바운스해서 호출). 네트워크 실패 시 false — 제출 시 서버가 최종 판정.
export async function idTaken(id: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/auth/id-taken?id=${encodeURIComponent(id)}`);
    const data = (await r.json().catch(() => ({}))) as { taken?: unknown };
    return data.taken === true;
  } catch {
    return false;
  }
}

// 저장된 토큰 payload에서 userId 추출 (exp 지났으면 null). 서명 검증은 서버가 담당.
export function session(): string | null {
  const raw = getToken();
  if (!raw) return null;
  try {
    const seg = raw.split('.')[1];
    if (!seg) return null;
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const payload = JSON.parse(atob(b64 + pad)) as { id?: unknown; exp?: unknown };
    if (typeof payload.id !== 'string' || typeof payload.exp !== 'number') return null;
    if (Date.now() >= payload.exp * 1000) return null;
    return payload.id;
  } catch {
    return null;
  }
}
