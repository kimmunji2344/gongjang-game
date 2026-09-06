// 클라이언트 src/data/authRules.ts 의 서버측 미러. 신뢰경계 — 클라 검증을 신뢰하지 않고 독립 검증.
// 규칙 변경 시 두 파일 모두 수정할 것.
// 반환: 문제없으면 null, 문제 있으면 한국어 사유 문자열.

const ID_RE = /^[가-힣a-zA-Z0-9]+$/; // 한글/영문/숫자만
const PW_RE = /^[a-zA-Z0-9]+$/; // 영문/숫자만

export function validateId(id: unknown): string | null {
  if (typeof id !== 'string') return '아이디 형식이 올바르지 않습니다';
  if (id.length < 4 || id.length > 12) return '아이디는 4~12자여야 합니다';
  if (!ID_RE.test(id)) return '아이디는 한글/영문/숫자만 가능합니다';
  return null;
}

export function validatePw(pw: unknown): string | null {
  if (typeof pw !== 'string') return '비밀번호 형식이 올바르지 않습니다';
  if (pw.length < 8) return '비밀번호는 8자 이상이어야 합니다';
  if (!PW_RE.test(pw)) return '비밀번호는 영문/숫자만 가능합니다';
  return null;
}
