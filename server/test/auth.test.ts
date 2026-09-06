import { describe, expect, it } from 'vitest';
import { validateId, validatePw } from '../src/validate';

process.env.JWT_SECRET ??= 'test-secret-not-real';
const { hashPw, verifyPw, signToken } = await import('../src/auth');

describe('validate — 서버측 ID/PW 규칙 미러', () => {
  it('ID는 4~12자', () => {
    expect(validateId('abc')).not.toBeNull();
    expect(validateId('abcd')).toBeNull();
    expect(validateId('a'.repeat(12))).toBeNull();
    expect(validateId('a'.repeat(13))).not.toBeNull();
  });
  it('ID는 한글/영문/숫자만 (특수기호·공백 불가)', () => {
    expect(validateId('가나다라')).toBeNull();
    expect(validateId('user_1')).not.toBeNull();
    expect(validateId('user 1')).not.toBeNull();
  });
  it('ID 비문자열 거부', () => {
    expect(validateId(undefined)).not.toBeNull();
    expect(validateId(123)).not.toBeNull();
  });
  it('PW는 8자 이상 영문/숫자', () => {
    expect(validatePw('abc123')).not.toBeNull();
    expect(validatePw('abcd1234')).toBeNull();
    expect(validatePw('abcd!234')).not.toBeNull();
  });
});

describe('auth — bcrypt 해시 + JWT', () => {
  it('해시 왕복: 맞는 비번 통과, 틀린 비번 실패', async () => {
    const h = await hashPw('abcd1234');
    expect(h).not.toBe('abcd1234');
    expect(await verifyPw('abcd1234', h)).toBe(true);
    expect(await verifyPw('wrongpw99', h)).toBe(false);
  });
  it('토큰에 id가 담기고 만료(exp)는 발급(iat) + 7일', () => {
    const t = signToken('tester');
    const payload = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()) as {
      id: string;
      exp: number;
      iat: number;
    };
    expect(payload.id).toBe('tester');
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
  });
});
