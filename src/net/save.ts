// 서버 세이브 불러오기/저장. 토큰은 auth/api 에서 가져온다. 계정당 1슬롯.
import { getToken, logOut } from '../auth/api';
import type { SimState } from '../sim/sim';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type LoadResult =
  | { status: 'ok'; state: SimState | null }
  | { status: 'reauth' } // 토큰 무효/만료 → 다시 로그인 필요
  | { status: 'error'; message: string };

export async function loadSave(): Promise<LoadResult> {
  const token = getToken();
  if (!token) return { status: 'reauth' };
  try {
    const r = await fetch(`${API_BASE}/api/save`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (r.status === 401) {
      logOut();
      return { status: 'reauth' };
    }
    if (!r.ok) return { status: 'error', message: `서버 오류 (${r.status})` };
    const data = (await r.json().catch(() => ({}))) as { state?: unknown };
    return { status: 'ok', state: isValidState(data.state) ? (data.state as SimState) : null };
  } catch {
    return { status: 'error', message: '서버에 연결할 수 없습니다' };
  }
}

export async function putSave(state: SimState): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const r = await fetch(`${API_BASE}/api/save`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ state }),
    });
    if (r.status === 401) logOut();
    return r.ok;
  } catch {
    return false;
  }
}

// 얕은 구조 검증 — 본인 세이브라 최소한만. 깨졌으면 새 게임으로 시작 (치팅 방지는 M5).
function isValidState(s: unknown): boolean {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  return (
    Array.isArray(o.placeables) &&
    Array.isArray(o.cargo) &&
    typeof o.gold === 'number' &&
    typeof o.tick === 'number' &&
    typeof o.freeConveyors === 'number' &&
    typeof o.nodeCooldown === 'object' &&
    o.nodeCooldown !== null
  );
}
