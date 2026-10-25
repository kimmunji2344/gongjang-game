// M7 — 인게임 DOM HUD(상단바·사이드바·NPC뱃지) + 팝업 내용 빌더. FactoryScene 은 이 모듈 호출만 하고
// sim 변형(this.sim 갱신)은 전부 FactoryScene 이 소유 — 여기선 읽기 전용 렌더링 + 콜백 전달만 한다.
import './hud.css';
import { ACHIEVEMENTS } from '../data/achievements';
import { CONFIG } from '../data/config';
import { RESOURCES } from '../data/resources';
import { TILE_PATTERNS } from '../data/tilePatterns';
import { DIR_ARROW, Dir } from '../sim/grid';
import {
  SimState,
  UpgradeCost,
  storageCap,
  storageTotal,
  totalInStorage,
  unlockedTier,
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
  onMyBuildings(): void;
  onCycleDir(): void;
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
    ['🏭 내 설비', cb.onMyBuildings],
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

  // 방향 칩 — 클릭하면 R키와 동일하게 방향 순환 (2026-09-20: 상호작용 안 되던 문제 해결)
  statsTool.style.cursor = 'pointer';
  statsTool.title = '클릭하거나 R 키를 눌러 방향을 바꿀 수 있어요';
  statsTool.onclick = cb.onCycleDir;

  topbar.append(stats, toolrow);
  document.getElementById('gj-shell')?.prepend(topbar);
}

export function setActiveTool(tool: Tool): void {
  if (!toolButtons) return;
  for (const t of TOOLS) toolButtons[t].classList.toggle('on', t === tool);
}

export function updateTopStats(sim: SimState): void {
  statsGold.textContent = `💰 ${sim.gold}G`;
  statsZone.textContent = `🗺️ 구역 ${sim.ownedZones.length}개 (다음 ${zoneCost(sim)}G)`;
  const locked = !sim.unlockedResources.includes('scrap');
  if (locked) {
    statsUnlock.textContent = `🔒 칩판매 ${sim.chipSold}/${CONFIG.resourceUnlockChips}`;
    return;
  }
  const tier = unlockedTier(sim.ownedZones.length);
  const nextNeed = CONFIG.tierUnlockZones[tier + 1];
  statsUnlock.textContent =
    nextNeed === undefined
      ? `🔓 가공 Tier ${tier} (전부 해금)`
      : `🔓 가공 Tier ${tier} · Tier ${tier + 1}은 구역 ${nextNeed}개`;
}

/** 현재 도구가 방향/자원을 갖는 배치 도구일 때, 설치될 방향·자원을 상단바에 표시 */
export function updateToolInfo(tool: Tool, dir: Dir, nodeResourceName: string | null): void {
  const dirPart = DIRECTIONAL_TOOLS.has(tool) ? ` 방향 ${DIR_ARROW[dir]} (R/클릭으로 회전)` : '';
  const resPart = tool === 'node' && nodeResourceName ? ` · 자원 ${nodeResourceName}` : '';
  statsTool.textContent = `🔧 ${TOOL_LABEL[tool]}${dirPart}${resPart}`;
}

// 업글/회전/긴급배출/철거 도구 선택 시 캔버스 마우스 커서를 심플한 원형 아이콘으로 교체 (2026-09-20 신규)
const CURSOR_SYMBOL: Partial<Record<Tool, string>> = {
  upgrade: '⬆',
  rotate: '↻',
  vent: '▼',
  remove: '✕',
};
const cursorCache = new Map<string, string>();
function cursorFor(symbol: string): string {
  const cached = cursorCache.get(symbol);
  if (cached) return cached;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'>` +
    `<circle cx='14' cy='14' r='12' fill='white' stroke='#4a4744' stroke-width='2'/>` +
    `<text x='14' y='19' font-size='14' text-anchor='middle' fill='#4a4744'>${symbol}</text></svg>`;
  const value = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 14 14, pointer`;
  cursorCache.set(symbol, value);
  return value;
}

export function setToolCursor(tool: Tool): void {
  const canvas = document.querySelector('#app canvas') as HTMLElement | null;
  if (!canvas) return;
  const symbol = CURSOR_SYMBOL[tool];
  canvas.style.cursor = symbol ? cursorFor(symbol) : '';
}

// 내 설비 팝업 — 같은 종류+레벨(Node 는 +자원)끼리 개수로 묶어서 표시 (2026-09-20 확정: "전부 묶어줘")
export function openMyBuildingsPopup(
  sim: SimState,
  shut: Record<string, { resources: string[]; weight: number }>,
): void {
  if (sim.placeables.length === 0) {
    openPopup({ title: '🏭 내 설비', accent: 'var(--mint)', bodyHtml: '아직 설치한 설비가 없어요' });
    return;
  }
  const order: string[] = [];
  const groups = new Map<string, { label: string; count: number }>();
  let shutCount = 0;

  for (const p of sim.placeables) {
    let key: string;
    let label: string;
    if (p.kind === 'node') {
      const lv = sim.nodeLevel[p.id] ?? 1;
      key = `node-${lv}-${p.resource}`;
      label = `🌱 Node Lv${lv} (${RESOURCES[p.resource]?.name ?? p.resource})`;
    } else if (p.kind === 'conveyor') {
      const lv = sim.conveyorLevel[p.id] ?? 1;
      key = `conveyor-${lv}`;
      label = `➡️ 컨베이어 Lv${lv}`;
    } else if (p.kind === 'converter') {
      key = 'converter';
      label = '🔮 Converter';
      if (shut[p.id]) shutCount += 1;
    } else if (p.kind === 'storage') {
      const lv = sim.storageLevel[p.id] ?? 1;
      key = `storage-${lv}`;
      label = `📦 Storage Lv${lv}`;
    } else {
      const lv = sim.exporterLevel[p.id] ?? 1;
      key = `exporter-${lv}`;
      label = `🚚 Exporter Lv${lv}`;
    }
    const g = groups.get(key);
    if (g) g.count += 1;
    else {
      groups.set(key, { label, count: 1 });
      order.push(key);
    }
  }

  const rows = order.map((key) => {
    const g = groups.get(key)!;
    const extra = key === 'converter' && shutCount > 0 ? ` · ⚠️${shutCount}개 셧다운` : '';
    return `<div class="row"><span>${g.label}</span><span>${g.count}개${extra}</span></div>`;
  });
  openPopup({ title: '🏭 내 설비', accent: 'var(--mint)', bodyHtml: rows.join('') });
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
