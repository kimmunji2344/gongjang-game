import { beforeEach, describe, expect, it } from 'vitest';
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

const { signUp, logIn, session, logOut, idExists } = await import('../src/auth/mockAuth');

beforeEach(() => _store.clear());

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

describe('목업 인증', () => {
  it('회원가입 → 로그인 성공 → 세션 유지', async () => {
    expect((await signUp('tester', 'abcd1234')).ok).toBe(true);
    expect(idExists('tester')).toBe(true);
    expect((await logIn('tester', 'abcd1234')).ok).toBe(true);
    expect(session()).toBe('tester');
  });
  it('중복 ID 거부', async () => {
    await signUp('dupid', 'abcd1234');
    expect(await signUp('dupid', 'zzzz9999')).toEqual({ ok: false, error: '중복아이디입니다' });
  });
  it('로그인 실패는 공용 에러 (아이디/비번 구분 안 함)', async () => {
    await signUp('user1', 'abcd1234');
    const msg = '아이디 또는 비밀번호가 일치하지 않습니다';
    expect(await logIn('user1', 'wrongpw99')).toEqual({ ok: false, error: msg });
    expect(await logIn('ghost', 'abcd1234')).toEqual({ ok: false, error: msg });
    expect(session()).toBeNull();
  });
  it('회원가입은 자동 로그인 안 함', async () => {
    await signUp('user2', 'abcd1234');
    expect(session()).toBeNull();
  });
  it('로그아웃 시 세션 제거', async () => {
    await signUp('user3', 'abcd1234');
    await logIn('user3', 'abcd1234');
    logOut();
    expect(session()).toBeNull();
  });
});
