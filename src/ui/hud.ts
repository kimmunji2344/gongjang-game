// M7 — 인게임 DOM HUD(상단바·사이드바·NPC뱃지) + 팝업 내용 빌더. FactoryScene 은 이 모듈 호출만 하고
// sim 변형(this.sim 갱신)은 전부 FactoryScene 이 소유 — 여기선 읽기 전용 렌더링 + 콜백 전달만 한다.
import './hud.css';
import { ACHIEVEMENTS } from '../data/achievements';
import { CONFIG } from '../data/config';
import { RESOURCES } from '../data/resources';
import { TILE_PATTERNS } from '../data/tilePatterns';
import { DIR_ARROW, Dir, Tile } from '../sim/grid';
import {
  SimState,
  UpgradeCost,
  storageCap,
  storageTotal,
  totalInStorage,
  zoneCost,
} from '../sim/sim';
import { HallOfFame, SeasonRanking } from '../net/rank';
import { openPopup } from './popup';

export type Tool =
  | 'zone'
  | 'conveyor'
  | 'node'
  | 'exporter'
  | 'converter'
  | 'storage'
  | 'upgrade'
  | 'rotate'
  | 'vent'
  | 'remove';

export const TOOLS: readonly Tool[] = [
  'zone',
  'conveyor',
  'node',
  'exporter',
  'converter',
  'storage',
  'upgrade',
  'rotate',
  'vent',
  'remove',
];
export const TOOL_LABEL: Record<Tool, string> = {
  zone: '구역',
  conveyor: '컨베이어',
  node: 'Node',
  exporter: 'Exporter',
  converter: 'Converter',
  storage: 'Storage',
  upgrade: '업글',
  rotate: '회전',
  vent: '긴급배출',
  remove: '철거',
};

export interface HudCallbacks {
  onTool(tool: Tool): void;
  onSave(): void;
  onRank(): void;
  onCodex(): void;
  onNpc(): void;
  onSettings(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

const DIRECTIONAL_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['conveyor', 'node', 'converter']);

let toolButtons: Record<Tool, HTMLButtonElement> | null = null;
let statsGold: HTMLElement, statsZone: HTMLElement, statsUnlock: HTMLElement, statsTool: HTMLElement;

export function mountHud(cb: HudCallbacks): void {
  if (document.getElementById('gj-topbar')) return;

  const topbar = el('div');
  topbar.id = 'gj-topbar';

  const stats = el('div', 'gj-stats');
  statsGold = el('span', 'gj-chip');
  statsZone = el('span', 'gj-chip');
  statsUnlock = el('span', 'gj-chip');
  statsTool = el('span', 'gj-chip');
  stats.append(statsGold, statsZone, statsUnlock, statsTool);

  const toolrow = el('div', 'gj-toolrow');
  const buttons: Partial<Record<Tool, HTMLButtonElement>> = {};
  for (const t of TOOLS) {
    const b = el('button', 'gj-btn small');
    b.textContent = TOOL_LABEL[t];
    b.onclick = () => cb.onTool(t);
    buttons[t] = b;
    toolrow.appendChild(b);
  }
  toolButtons = buttons as Record<Tool, HTMLButtonElement>;

  const sep = el('div', 'gj-sep');
  toolrow.appendChild(sep);

  const actions: [string, () => void][] = [
    ['💾 저장', cb.onSave],
    ['🏆 랭킹', cb.onRank],
    ['📖 도감', cb.onCodex],
    ['👤 NPC', cb.onNpc],
    ['⚙️ 설정', cb.onSettings],
  ];
  for (const [label, fn] of actions) {
    const b = el('button', 'gj-btn small');
    b.textContent = label;
    b.onclick = fn;
    toolrow.appendChild(b);
  }

  topbar.append(stats, toolrow);
  document.getElementById('gj-shell')?.prepend(topbar);

  const sidebar = el('div');
  sidebar.id = 'gj-sidebar';
  document.body.appendChild(sidebar);
}

export function setActiveTool(tool: Tool): void {
  if (!toolButtons) return;
  for (const t of TOOLS) toolButtons[t].classList.toggle('on', t === tool);
}

export function updateTopStats(sim: SimState): void {
  statsGold.textContent = `💰 ${sim.gold}G`;
  statsZone.textContent = `🗺️ 구역 ${sim.ownedZones.length}개 (다음 ${zoneCost(sim)}G)`;
  const locked = !sim.unlockedResources.includes('scrap');
  statsUnlock.textContent = locked
    ? `🔒 칩판매 ${sim.chipSold}/${CONFIG.resourceUnlockChips}`
    : '🔓 자원 해금됨';
}

/** 현재 도구가 방향/자원을 갖는 배치 도구일 때, 설치될 방향·자원을 상단바에 표시 */
export function updateToolInfo(tool: Tool, dir: Dir, nodeResourceName: string | null): void {
  const dirPart = DIRECTIONAL_TOOLS.has(tool) ? ` 방향 ${DIR_ARROW[dir]}` : '';
  const resPart = tool === 'node' && nodeResourceName ? ` · 자원 ${nodeResourceName}` : '';
  statsTool.textContent = `🔧 ${TOOL_LABEL[tool]}${dirPart}${resPart}`;
}

export function updateSidebar(
  sim: SimState,
  shut: Record<string, { resources: string[]; weight: number }>,
  onVent: (tile: Tile) => void,
): void {
  const sidebar = document.getElementById('gj-sidebar');
  if (!sidebar) return;
  const topbar = document.getElementById('gj-topbar');
  if (topbar) sidebar.style.top = `${topbar.getBoundingClientRect().height + 14}px`;
  sidebar.innerHTML = '<h4>내 설비</h4>';
  if (sim.placeables.length === 0) {
    sidebar.innerHTML += '<div class="gj-srow">아직 설치한 설비가 없어요</div>';
    return;
  }
  for (const p of sim.placeables) {
    const row = el('div', 'gj-srow');
    if (p.kind === 'node') {
      const lv = sim.nodeLevel[p.id] ?? 1;
      row.textContent = `🌱 Node Lv${lv} (${RESOURCES[p.resource]?.name ?? p.resource})`;
    } else if (p.kind === 'converter') {
      const bl = sim.converterBacklog[p.id] ?? {};
      const parts = Object.entries(bl).map(([r, n]) => `${RESOURCES[r]?.name ?? r}x${n}`);
      const sd = shut[p.id];
      row.textContent = `🔮 Converter — 재고 ${parts.length ? parts.join(' ') : '없음'}`;
      if (sd) {
        row.classList.add('danger');
        row.textContent += ` · ⚠ ${sd.resources.map((r) => RESOURCES[r]?.name ?? r).join(',')} 과잉`;
        const vent = el('button', 'vent-btn');
        vent.textContent = '긴급배출 (무료, 임시방편)';
        vent.onclick = () => onVent(p.tile);
        row.appendChild(vent);
      }
    } else if (p.kind === 'storage') {
      const lv = sim.storageLevel[p.id] ?? 1;
      row.textContent = `📦 Storage Lv${lv} — ${storageTotal(sim, p.id)}/${storageCap(lv)}`;
    } else if (p.kind === 'exporter') {
      const lv = sim.exporterLevel[p.id] ?? 1;
      const prog = sim.exporterProgress[p.id] ?? 0;
      const pct = Math.round(lv * CONFIG.exporterRevenuePctPerLevel * 100);
      const next =
        lv < CONFIG.maxLevel ? `${prog}/${CONFIG.exporterLevelThresholds[lv - 1]}` : '최대';
      row.textContent = `🚚 Exporter Lv${lv} (+${pct}%, ${next})`;
    } else {
      const lv = sim.conveyorLevel[p.id] ?? 1;
      if (lv <= 1) continue;
      row.textContent = `➡️ 컨베이어 Lv${lv}`;
    }
    sidebar.appendChild(row);
  }
}

export function updateNpcBadge(sim: SimState, onClick: () => void): void {
  let badge = document.getElementById('gj-npc-badge');
  if (!badge) {
    badge = el('div');
    badge.id = 'gj-npc-badge';
    badge.onclick = onClick;
    document.body.appendChild(badge);
  }
  const npc = sim.npc;
  if (!npc) badge.textContent = '👤 오늘 방문한 NPC 없음';
  else if (npc.done) badge.textContent = '👤 오늘 요청 완료! 내일 또 올게요';
  else {
    const name = RESOURCES[npc.resource]?.name ?? npc.resource;
    const have = totalInStorage(sim.storage, npc.resource);
    badge.textContent = `👤 ${name} x${npc.qty} 요청 (보유 ${have})`;
  }
}

// ---- 팝업 내용 빌더 --------------------------------------------------------

export function openRankLoadingPopup(): void {
  openPopup({ title: '🏆 시즌 랭킹', accent: 'var(--sky)', bodyHtml: '불러오는 중...' });
}

export function openRankPopup(season: SeasonRanking | null, hof: HallOfFame | null): void {
  const rows: string[] = [];
  if (!season || season.entries.length === 0) {
    rows.push('<div class="row">기록 없음</div>');
  } else {
    for (const e of season.entries) {
      rows.push(
        `<div class="row"><span>${e.rank}위 ${e.userId}</span><span>${e.seasonRevenue}G · WAR ${e.war.toFixed(1)}</span></div>`,
      );
    }
  }
  let hofHtml = '<h4 style="margin:14px 0 4px;font-family:var(--font-display);font-size:14px;">명예의 전당</h4>';
  const seasons = hof?.seasons ?? [];
  if (seasons.length === 0) {
    hofHtml += '<div class="row">지난 시즌 없음</div>';
  } else {
    for (const s of seasons) {
      hofHtml += `<div style="margin-top:6px;font-weight:bold;">${s.seasonId}</div>`;
      for (const e of s.entries.slice(0, 3)) {
        hofHtml += `<div class="row"><span>${e.rank}위 ${e.userId}</span><span>${e.seasonRevenue}G</span></div>`;
      }
    }
  }
  openPopup({
    title: `🏆 시즌 랭킹 ${season?.season ?? ''}`,
    accent: 'var(--sky)',
    bodyHtml: rows.join('') + hofHtml,
  });
}

export function openCodexPopup(sim: SimState, tab: 'res' | 'ach' | 'tile' = 'res'): void {
  let body = '';
  if (tab === 'res') {
    body = sim.codexResources.length
      ? sim.codexResources.map((r) => `<div class="row"><span>${RESOURCES[r]?.name ?? r}</span></div>`).join('')
      : '<div class="row">아직 없음</div>';
  } else if (tab === 'ach') {
    body = ACHIEVEMENTS.map(
      (a) => `<div class="row"><span>${sim.codexAchievements.includes(a.id) ? '✓' : '✗'} ${a.name}</span></div>`,
    ).join('');
  } else {
    const found = TILE_PATTERNS.filter((p) => sim.codexTilePatterns.includes(p.id));
    body = found.length
      ? found.map((p) => `<div class="row"><span>${p.name}</span></div>`).join('')
      : '<div class="row">아직 발견한 히든 패턴이 없어요</div>';
  }
  openPopup({
    title: '📖 도감',
    accent: 'var(--lavender)',
    bodyHtml: body,
    tabs: [
      { label: '자원', active: tab === 'res', onClick: () => openCodexPopup(sim, 'res') },
      { label: '업적', active: tab === 'ach', onClick: () => openCodexPopup(sim, 'ach') },
      { label: '타일(히든)', active: tab === 'tile', onClick: () => openCodexPopup(sim, 'tile') },
    ],
  });
}

export function openNpcPopup(sim: SimState, onHandIn: () => void): void {
  const npc = sim.npc;
  let body: string;
  let buttons: { label: string; onClick: () => void; primary?: boolean }[] = [];
  if (!npc) {
    body = '오늘은 방문한 NPC가 없어요. 내일 다시 확인해보세요!';
  } else if (npc.done) {
    body = '오늘 요청은 이미 완료했어요. 내일 또 방문합니다!';
  } else {
    const name = RESOURCES[npc.resource]?.name ?? npc.resource;
    const have = totalInStorage(sim.storage, npc.resource);
    body = `<div class="row"><span>요청 자원</span><span>${name}</span></div>
      <div class="row"><span>요청 수량</span><span>${npc.qty}</span></div>
      <div class="row"><span>내 보유량</span><span>${have}</span></div>
      <p style="margin-top:10px;color:var(--ink-soft);">Storage 에서 인출해 건네주면 기본 판매가의 ${CONFIG.npcAlphaMultiplier}배로 쳐줘요.</p>`;
    buttons = [{ label: '건네기', primary: true, onClick: onHandIn }];
  }
  openPopup({ title: '👤 NPC 요청', accent: 'var(--pink)', bodyHtml: body, buttons });
}

export function openStoragePopup(sim: SimState, storageId: string): void {
  const lv = sim.storageLevel[storageId] ?? 1;
  const contents = Object.entries(sim.storage[storageId] ?? {}).filter(([, n]) => n > 0);
  const body =
    `<div class="row"><span>레벨</span><span>Lv${lv}</span></div>` +
    `<div class="row"><span>용량</span><span>${storageTotal(sim, storageId)}/${storageCap(lv)}</span></div>` +
    (contents.length
      ? contents
          .map(([r, n]) => `<div class="row"><span>${RESOURCES[r]?.name ?? r}</span><span>${n}</span></div>`)
          .join('')
      : '<div class="row">비어 있음</div>');
  openPopup({ title: '📦 창고', accent: 'var(--butter)', bodyHtml: body });
}

export function openSettingsPopup(onLogout: () => void, onSave: () => void): void {
  openPopup({
    title: '⚙️ 설정',
    accent: 'var(--lavender)',
    bodyHtml: '<p style="color:var(--ink-soft);">저장하거나 계정에서 로그아웃할 수 있어요.</p>',
    buttons: [
      { label: '수동 저장', onClick: onSave },
      { label: '로그아웃', onClick: onLogout },
    ],
  });
}

export function openUpgradePopup(
  kindLabel: string,
  currentLevel: number,
  cost: UpgradeCost | null,
  onConfirm: () => void,
): void {
  if (!cost) {
    openPopup({
      title: `⬆️ ${kindLabel} 업그레이드`,
      accent: 'var(--mint)',
      bodyHtml: `이미 최대 레벨(Lv${currentLevel})이에요!`,
    });
    return;
  }
  const matPart = cost.material
    ? `<div class="row"><span>재료</span><span>${RESOURCES[cost.material]?.name ?? cost.material} x${cost.materialQty}</span></div>`
    : '';
  openPopup({
    title: `⬆️ ${kindLabel} 업그레이드`,
    accent: 'var(--mint)',
    bodyHtml:
      `<div class="row"><span>레벨</span><span>Lv${currentLevel} → Lv${currentLevel + 1}</span></div>` +
      `<div class="row"><span>비용</span><span>${cost.gold}G</span></div>` +
      matPart,
    buttons: [{ label: '업그레이드', primary: true, onClick: onConfirm }],
  });
}

export function openDirectionPopup(onPick: (dir: Dir) => void): void {
  const dirs: { d: Dir; label: string }[] = [
    { d: 'N', label: '↑ 위' },
    { d: 'E', label: '→ 오른쪽' },
    { d: 'S', label: '↓ 아래' },
    { d: 'W', label: '← 왼쪽' },
  ];
  openPopup({
    title: '🔄 방향 선택',
    accent: 'var(--sky)',
    bodyHtml: '<p style="color:var(--ink-soft);margin:0 0 8px;">설비가 바라볼 방향을 골라주세요.</p>',
    buttons: dirs.map((d) => ({ label: d.label, onClick: () => onPick(d.d) })),
  });
}

export function openShutdownPopup(
  info: { resources: string[]; weight: number },
  onVent: () => void,
): void {
  const names = info.resources.map((r) => RESOURCES[r]?.name ?? r).join(', ');
  openPopup({
    title: '⚠️ 셧다운',
    accent: 'var(--danger)',
    bodyHtml:
      `<div class="row"><span>과잉 자원</span><span>${names}</span></div>` +
      `<div class="row"><span>누적 무게</span><span>${info.weight}</span></div>` +
      `<p style="margin-top:10px;color:var(--ink-soft);">Storage 로 우회해도 임시방편이에요 — 결국 다시 가득 찰 수 있으니, 배치 밸런스를 조정해보세요.</p>`,
    buttons: [{ label: '긴급배출 (무료)', primary: true, onClick: onVent }],
  });
}
