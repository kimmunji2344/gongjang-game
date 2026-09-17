// M7 — 공용 팝업(모달)·토스트 DOM 헬퍼. 랭킹/도감/NPC/창고/설정/셧다운/방향선택이 전부 이걸로 통일됨.

function root(id: string, parentStyle?: Partial<CSSStyleDeclaration>): HTMLElement {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    if (parentStyle) Object.assign(el.style, parentStyle);
    document.body.appendChild(el);
  }
  return el;
}

export interface PopupButton {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface PopupOptions {
  title: string;
  accent?: string; // CSS 색상 변수값, 예: 'var(--mint)'
  bodyHtml: string;
  buttons?: PopupButton[];
  tabs?: { label: string; onClick: () => void; active?: boolean }[];
}

export function closePopup(): void {
  root('gj-popup-root').innerHTML = '';
}

export function openPopup(opts: PopupOptions): void {
  const r = root('gj-popup-root');
  r.innerHTML = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'gj-backdrop';
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closePopup();
  };

  const popup = document.createElement('div');
  popup.className = 'gj-popup';
  if (opts.accent) popup.style.setProperty('--accent', opts.accent);

  const head = document.createElement('div');
  head.className = 'gj-popup-head';
  head.innerHTML = `<span>${opts.title}</span>`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'gj-popup-close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => closePopup();
  head.appendChild(closeBtn);
  popup.appendChild(head);

  if (opts.tabs && opts.tabs.length > 0) {
    const tabs = document.createElement('div');
    tabs.className = 'gj-tabs';
    for (const t of opts.tabs) {
      const b = document.createElement('button');
      b.textContent = t.label;
      if (t.active) b.classList.add('on');
      b.onclick = t.onClick;
      tabs.appendChild(b);
    }
    popup.appendChild(tabs);
  }

  const body = document.createElement('div');
  body.className = 'gj-popup-body';
  body.innerHTML = opts.bodyHtml;
  popup.appendChild(body);

  if (opts.buttons && opts.buttons.length > 0) {
    const foot = document.createElement('div');
    foot.className = 'gj-popup-foot';
    for (const b of opts.buttons) {
      const btn = document.createElement('button');
      btn.className = 'gj-btn' + (b.primary ? ' on' : '');
      btn.textContent = b.label;
      // 버튼 클릭 = 동작 실행 + 팝업 닫기 (모든 팝업 공통 규칙)
      btn.onclick = () => {
        b.onClick();
        closePopup();
      };
      foot.appendChild(btn);
    }
    popup.appendChild(foot);
  }

  backdrop.appendChild(popup);
  r.appendChild(backdrop);
}

let toastTimer: number | undefined;

/** 배치/업그레이드 결과 등 즉각 피드백. 팝업과 달리 블로킹 없이 잠깐 떴다 사라짐. */
export function showToast(text: string, kind: 'ok' | 'bad' = 'ok'): void {
  if (!text) return;
  const r = root('gj-toast-root');
  r.innerHTML = '';
  const t = document.createElement('div');
  t.className = 'gj-toast' + (kind === 'bad' ? ' bad' : '');
  t.textContent = text;
  r.appendChild(t);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    r.innerHTML = '';
  }, 1800);
}
