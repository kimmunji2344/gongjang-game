import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkId, checkPw, checkPwConfirm } from '../src/data/authRules';

// vitest(node) 환경엔 localStorage가 없어 셰임 주입
const _store = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  get length() {
    return _store.size;
  },
  clear: () => _store.clear(),
  getItem: (k: string) => _store.get(k) ?? null,
  key: (i: number) => [..._store.keys()][i] ?? null,
  removeItem: (k: string) => void _store.delete(k),
  setItem: (k: string, v: string) => void _store.set(k, v),
};

const { signUp, logIn, idTaken, session, logOut, getToken } = await import('../src/auth/api');

// 테스트용 JWT (서명은 클라가 검증 안 하므로 아무 값). session()이 base64 표준/url 둘 다 처리.
function fakeJwt(payload: Record<string, unknown>): string {
  return `header.${btoa(JSON.stringify(payload))}.sig`;
}

const soon = () => Math.floor(Date.now() / 1000) + 999;
const past = () => Math.floor(Date.now() / 1000) - 1;

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        ({
          ok: status >= 200 && status < 300,
          status,
          json: async () => body,
        }) as Response,
    ),
  );
}

beforeEach(() => _store.clear());
afterEach(() => vi.unstubAllGlobals());

describe('입력 규칙 (Obsidian 시작 화면 & 계정 시스템)', () => {
  it('ID는 4~12자', () => {
    expect(checkId('abc').ok).toBe(false);
    expect(checkId('abcd').ok).toBe(true);
    expect(checkId('a'.repeat(12)).ok).toBe(true);
    expect(checkId('a'.repeat(13)).ok).toBe(false);
  });
  it('ID는 한글/영문/숫자만 (특수기호·공백 불가)', () => {
    expect(checkId('가나다라').ok).toBe(true);
    expect(checkId('user_1').ok).toBe(false);
    expect(checkId('user 1').ok).toBe(false);
  });
  it('PW는 8자 이상 영문/숫자', () => {
    expect(checkPw('abc123').ok).toBe(false);
    expect(checkPw('abcd1234').ok).toBe(true);
    expect(checkPw('abcd!234').ok).toBe(false);
  });
  it('PW 확인 일치 여부', () => {
    expect(checkPwConfirm('abcd1234', 'abcd1234').ok).toBe(true);
    expect(checkPwConfirm('abcd1234', 'abcd9999').ok).toBe(false);
  });
});

describe('api.ts — 서버 인증 클라이언트', () => {
  it('회원가입 성공', async () => {
    mockFetch({ ok: true });
    expect(await signUp('tester', 'abcd1234')).toEqual({ ok: true });
  });

  it('회원가입 중복 → 서버 에러 메시지 그대로 전달', async () => {
    mockFetch({ ok: false, error: '중복아이디입니다' }, 400);
    expect(await signUp('dupid', 'abcd1234')).toEqual({ ok: false, error: '중복아이디입니다' });
  });

  it('서버 연결 불가 시 연결 에러', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    expect(await signUp('tester', 'abcd1234')).toEqual({
      ok: false,
      error: '서버에 연결할 수 없습니다',
    });
  });

  it('로그인 성공 → 토큰 저장 + session()이 id 반환', async () => {
    const token = fakeJwt({ id: 'tester', exp: soon() });
    mockFetch({ token });
    expect(await logIn('tester', 'abcd1234')).toEqual({ ok: true });
    expect(getToken()).toBe(token);
    expect(session()).toBe('tester');
  });

  it('로그인 실패는 공용 에러 (아이디/비번 구분 안 함)', async () => {
    mockFetch({ error: '아이디 또는 비밀번호가 일치하지 않습니다' }, 401);
    expect(await logIn('ghost', 'abcd1234')).toEqual({
      ok: false,
      error: '아이디 또는 비밀번호가 일치하지 않습니다',
    });
    expect(session()).toBeNull();
  });

  it('session(): 만료된 토큰은 null', () => {
    _store.set('gongjang_token', fakeJwt({ id: 'u', exp: past() }));
    expect(session()).toBeNull();
  });

  it('session(): 깨진 토큰은 null', () => {
    _store.set('gongjang_token', 'not-a-jwt');
    expect(session()).toBeNull();
  });

  it('logOut() 시 세션 제거', () => {
    _store.set('gongjang_token', fakeJwt({ id: 'u', exp: soon() }));
    logOut();
    expect(session()).toBeNull();
  });

  it('idTaken(): 서버 응답 전달', async () => {
    mockFetch({ taken: true });
    expect(await idTaken('someid')).toBe(true);
    mockFetch({ taken: false });
    expect(await idTaken('someid')).toBe(false);
  });
});
