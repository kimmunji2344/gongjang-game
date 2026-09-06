// 앞단 흐름: 메뉴 → 인증(로그인/회원가입) → 로딩(서버 접속 + 세이브 로드) → 게임.
// 화면은 전부 DOM (Phaser는 로그인 통과 후에만 로드).
import './screens.css';
import { checkId, checkPw, checkPwConfirm, type FieldCheck } from '../data/authRules';
import { idTaken, logIn, logOut, session, signUp } from '../auth/api';
import { loadSave } from '../net/save';
import type { SimState } from '../sim/sim';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const DUP_CHECK_DEBOUNCE_MS = 400;

function $<T extends HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`요소 없음: ${sel}`);
  return el;
}

function buildDom(): void {
  if (document.getElementById('ui')) return;
  const ui = document.createElement('div');
  ui.id = 'ui';
  ui.hidden = true;
  ui.innerHTML = `
    <div id="ui-menu" class="screen">
      <h1>공장게임</h1>
      <button id="menu-start">START</button>
    </div>
    <div id="ui-auth" class="screen">
      <div class="card">
        <div class="tabs">
          <button id="tab-login" class="on" type="button">로그인</button>
          <button id="tab-signup" type="button">회원가입</button>
        </div>
        <h2 id="auth-title">로그인</h2>
        <label>아이디</label>
        <input id="auth-id" autocomplete="off" maxlength="12" />
        <div id="hint-id" class="hint"></div>
        <label>비밀번호</label>
        <input id="auth-pw" type="password" autocomplete="off" />
        <div id="hint-pw" class="hint"></div>
        <div id="row-confirm" hidden>
          <label>비밀번호 확인</label>
          <input id="auth-confirm" type="password" autocomplete="off" />
          <div id="hint-confirm" class="hint"></div>
        </div>
        <button id="auth-submit" class="submit" type="button">로그인</button>
        <div id="auth-error" class="form-error"></div>
      </div>
    </div>
    <div id="ui-loading" class="screen">
      <span id="ui-loading-text">서버에 접속 중입니다...</span>
    </div>
  `;
  document.body.appendChild(ui);
}

function show(screen: 'menu' | 'auth' | 'loading', bg: string): void {
  const ui = $('#ui');
  ui.hidden = false;
  ui.className = bg;
  ui.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $(`#ui-${screen}`).classList.add('active');
}

function fieldHint(el: HTMLElement, value: string, check: FieldCheck): void {
  if (value.length === 0) {
    el.className = 'hint';
    el.textContent = '';
    return;
  }
  el.className = 'hint ' + (check.ok ? 'ok' : 'bad');
  el.textContent = check.msg;
}

// --- 메뉴 ---
function runMenu(): Promise<void> {
  return new Promise((resolve) => {
    show('menu', 'menu-bg');
    const start = $<HTMLButtonElement>('#menu-start');
    start.onclick = () => {
      start.onclick = null;
      resolve();
    };
  });
}

// --- 인증 팝업 (로그인 성공 시 resolve) ---
function runAuth(): Promise<void> {
  return new Promise((resolve) => {
    show('auth', 'dim');
    let mode: 'login' | 'signup' = 'login';

    const idInput = $<HTMLInputElement>('#auth-id');
    const pwInput = $<HTMLInputElement>('#auth-pw');
    const confirmInput = $<HTMLInputElement>('#auth-confirm');
    const idHint = $('#hint-id');
    const pwHint = $('#hint-pw');
    const confirmHint = $('#hint-confirm');
    const err = $('#auth-error');
    const submit = $<HTMLButtonElement>('#auth-submit');

    // 회원가입 중복 ID 체크 — 서버 호출을 디바운스. 결과 확정 전엔 제출 막음.
    let dupTimer: number | undefined;
    let checkedId = ''; // 서버에 마지막으로 물어본 id
    let checkedTaken = false; // 그 결과

    function scheduleDupCheck(id: string): void {
      window.clearTimeout(dupTimer);
      dupTimer = window.setTimeout(() => {
        void idTaken(id).then((taken) => {
          checkedId = id;
          checkedTaken = taken;
          if (mode === 'signup' && idInput.value.trim() === id) refresh();
        });
      }, DUP_CHECK_DEBOUNCE_MS);
    }

    function refresh(): void {
      err.textContent = '';
      err.classList.remove('ok');
      const id = idInput.value.trim();
      const pw = pwInput.value;

      if (mode === 'signup') {
        const ci = checkId(id);
        const cp = checkPw(pw);
        const cc = checkPwConfirm(pw, confirmInput.value);
        const settled = ci.ok && checkedId === id; // 서버 확인 완료 여부
        const dup = settled && checkedTaken;

        if (!ci.ok) {
          fieldHint(idHint, id, ci);
        } else if (!settled) {
          idHint.className = 'hint';
          idHint.textContent = '확인 중...';
        } else {
          fieldHint(
            idHint,
            id,
            dup
              ? { ok: false, msg: '중복아이디입니다' }
              : { ok: true, msg: '사용 가능한 아이디입니다' },
          );
        }
        fieldHint(pwHint, pw, cp);
        fieldHint(confirmHint, confirmInput.value, cc);

        submit.disabled = !(settled && !dup && cp.ok && cc.ok);
        if (ci.ok && checkedId !== id) scheduleDupCheck(id);
      } else {
        idHint.textContent = '';
        pwHint.textContent = '';
        submit.disabled = id.length === 0 || pw.length === 0;
      }
    }

    function setMode(next: 'login' | 'signup'): void {
      mode = next;
      $('#tab-login').classList.toggle('on', mode === 'login');
      $('#tab-signup').classList.toggle('on', mode === 'signup');
      $('#row-confirm').hidden = mode === 'login';
      $('#auth-title').textContent = mode === 'login' ? '로그인' : '회원가입';
      submit.textContent = mode === 'login' ? '로그인' : '회원가입';
      // 모드 전환 시 입력값 전부 비움 (아이디/비밀번호/확인) — 로그인↔회원가입 양방향
      idInput.value = '';
      pwInput.value = '';
      confirmInput.value = '';
      window.clearTimeout(dupTimer);
      checkedId = '';
      checkedTaken = false;
      refresh();
    }

    async function onSubmit(): Promise<void> {
      submit.disabled = true;
      const id = idInput.value.trim();
      const pw = pwInput.value;

      if (mode === 'signup') {
        const r = await signUp(id, pw);
        if (r.ok) {
          setMode('login'); // setMode가 아이디/비밀번호/확인 전부 비움
          err.classList.add('ok');
          err.textContent = '회원가입 완료. 로그인해 주세요.';
        } else {
          submit.disabled = false;
          err.textContent = r.error;
        }
        return;
      }

      const r = await logIn(id, pw);
      if (r.ok) {
        cleanup();
        resolve();
        return;
      }
      submit.disabled = false;
      err.textContent = r.error;
    }

    // 로그인 모드에서 아이디/비밀번호가 모두 채워졌을 때 Enter → 로그인
    function onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Enter' && mode === 'login' && !submit.disabled) {
        e.preventDefault();
        void onSubmit();
      }
    }

    function cleanup(): void {
      window.clearTimeout(dupTimer);
      $('#tab-login').onclick = null;
      $('#tab-signup').onclick = null;
      idInput.oninput = pwInput.oninput = confirmInput.oninput = null;
      idInput.onkeydown = pwInput.onkeydown = null;
      submit.onclick = null;
    }

    $('#tab-login').onclick = () => setMode('login');
    $('#tab-signup').onclick = () => setMode('signup');
    idInput.oninput = refresh;
    pwInput.oninput = refresh;
    confirmInput.oninput = refresh;
    idInput.onkeydown = onKeydown;
    pwInput.onkeydown = onKeydown;
    submit.onclick = () => void onSubmit();

    setMode('login'); // 입력값 초기화 포함
  });
}

// --- 로딩: 서버 접속 + 세이브 로드. 토큰 무효면 'reauth' 반환. ---
type LoadOutcome = SimState | null | 'reauth';

async function runLoading(): Promise<LoadOutcome> {
  show('loading', '');
  const text = $('#ui-loading-text');
  text.textContent = '서버에 접속 중입니다...';
  const slow = window.setTimeout(() => {
    text.textContent = '서버에 접속 중입니다... (최대 1분 정도 걸릴 수 있어요)';
  }, 5000);

  const res = await loadSave();
  window.clearTimeout(slow);

  if (res.status === 'reauth') return 'reauth';
  if (res.status === 'error') {
    text.textContent = `${res.message} — 화면을 클릭하면 다시 시도합니다`;
    await new Promise<void>((r) => {
      const el = $('#ui-loading');
      el.onclick = () => {
        el.onclick = null;
        r();
      };
    });
    return runLoading();
  }

  text.textContent = '불러오는 중...';
  await delay(300);
  return res.state;
}

/** 메뉴 → 인증 → 로딩. 유효 토큰이 있으면 메뉴/인증을 건너뛴다. 게임 진입 준비되면 userId + 세이브 반환. */
export async function runPreGameFlow(): Promise<{ userId: string; save: SimState | null }> {
  buildDom();
  for (;;) {
    if (!session()) {
      await runMenu();
      await runAuth();
    }
    const loaded = await runLoading();
    if (loaded === 'reauth') {
      logOut();
      continue; // 토큰 무효/만료 → 메뉴·로그인부터 다시
    }
    const userId = session();
    if (!userId) {
      logOut();
      continue;
    }
    $('#ui').hidden = true;
    return { userId, save: loaded };
  }
}

export { logOut };
