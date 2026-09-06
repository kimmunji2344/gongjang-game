// M0 앞단 흐름: 메뉴 → 인증(로그인/회원가입) → 로딩 → 게임.
// 화면은 전부 DOM (Phaser는 로그인 통과 후에만 로드).
import './screens.css';
import { checkId, checkPw, checkPwConfirm, type FieldCheck } from '../data/authRules';
import { idExists, logIn, logOut, session, signUp } from '../auth/mockAuth';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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

    function refresh(): void {
      err.textContent = '';
      err.classList.remove('ok');
      const id = idInput.value.trim();
      const pw = pwInput.value;

      if (mode === 'signup') {
        const ci = checkId(id);
        const dup = ci.ok && idExists(id);
        const cp = checkPw(pw);
        const cc = checkPwConfirm(pw, confirmInput.value);
        fieldHint(idHint, id, dup ? { ok: false, msg: '중복아이디입니다' } : ci);
        fieldHint(pwHint, pw, cp);
        fieldHint(confirmHint, confirmInput.value, cc);
        submit.disabled = !(ci.ok && !dup && cp.ok && cc.ok);
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
      confirmInput.value = '';
      refresh();
    }

    async function onSubmit(): Promise<void> {
      submit.disabled = true;
      const id = idInput.value.trim();
      const pw = pwInput.value;

      if (mode === 'signup') {
        const r = await signUp(id, pw);
        if (r.ok) {
          setMode('login');
          pwInput.value = '';
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

    function cleanup(): void {
      $('#tab-login').onclick = null;
      $('#tab-signup').onclick = null;
      idInput.oninput = pwInput.oninput = confirmInput.oninput = null;
      submit.onclick = null;
    }

    $('#tab-login').onclick = () => setMode('login');
    $('#tab-signup').onclick = () => setMode('signup');
    idInput.oninput = refresh;
    pwInput.oninput = refresh;
    confirmInput.oninput = refresh;
    submit.onclick = () => void onSubmit();

    idInput.value = '';
    pwInput.value = '';
    setMode('login');
  });
}

// --- 로딩 (M0: 서버 접속을 짧은 지연으로 시뮬. M4에서 실제 연결로 교체) ---
async function runLoading(): Promise<void> {
  show('loading', '');
  const text = $('#ui-loading-text');
  text.textContent = '서버에 접속 중입니다...';
  await delay(600);
  text.textContent = '불러오는 중...';
  await delay(500);
}

/** 메뉴 → 인증 → 로딩. 유효 토큰이 있으면 메뉴/인증을 건너뛴다. 게임 진입 준비되면 userId 반환. */
export async function runPreGameFlow(): Promise<string> {
  buildDom();
  if (!session()) {
    await runMenu();
    await runAuth();
  }
  await runLoading();
  const userId = session();
  $('#ui').hidden = true;
  if (!userId) throw new Error('세션이 없습니다 (로그인 흐름 오류)');
  return userId;
}

export { logOut };
