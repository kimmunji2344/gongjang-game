// 회원가입/로그인 입력 규칙. 출처: Obsidian 공장게임.md > 시작 화면 & 계정 시스템
// (사양서 명시값 — 임시값 아님)

export const ID_MIN = 4;
export const ID_MAX = 12;
export const PW_MIN = 8;

const ID_RE = /^[가-힣a-zA-Z0-9]+$/; // 한글/영문/숫자만, 특수기호·공백 불가
const PW_RE = /^[a-zA-Z0-9]+$/;      // 영문/숫자만 (대소문자 구분은 저장·비교에서 처리)

export type FieldCheck = { ok: boolean; msg: string };

export function checkId(id: string): FieldCheck {
  if (id.length === 0) return { ok: false, msg: '아이디를 입력하세요' };
  if (id.length < ID_MIN || id.length > ID_MAX)
    return { ok: false, msg: `아이디는 ${ID_MIN}~${ID_MAX}자여야 합니다` };
  if (!ID_RE.test(id)) return { ok: false, msg: '아이디는 한글/영문/숫자만 가능합니다' };
  return { ok: true, msg: '사용 가능한 형식입니다' };
}

export function checkPw(pw: string): FieldCheck {
  if (pw.length === 0) return { ok: false, msg: '비밀번호를 입력하세요' };
  if (pw.length < PW_MIN) return { ok: false, msg: `비밀번호는 ${PW_MIN}자 이상이어야 합니다` };
  if (!PW_RE.test(pw)) return { ok: false, msg: '비밀번호는 영문/숫자만 가능합니다' };
  return { ok: true, msg: '사용 가능한 형식입니다' };
}

export function checkPwConfirm(pw: string, confirm: string): FieldCheck {
  if (confirm.length === 0) return { ok: false, msg: '비밀번호를 다시 입력하세요' };
  if (pw !== confirm) return { ok: false, msg: '비밀번호가 일치하지 않습니다' };
  return { ok: true, msg: '일치합니다' };
}
