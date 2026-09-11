// M1~M3 렌더 + 입력. 그래픽은 전부 플레이스홀더 (M7에서 일괄 교체 예정).
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { RESOURCES } from '../data/resources';
import { gradeToTicks } from '../data/speed';
import { DIR_ARROW, DIR_VEC, Dir, Tile } from '../sim/grid';
import {
  PlaceResult,
  SimState,
  buyZone,
  computeRoutes,
  findPath,
  initialState,
  placeBuilding,
  placeConverter,
  placeConveyor,
  placeStorage,
  removePlaceable,
  shutdownInfo,
  step,
  stoppedPlaceables,
  storageCap,
  storageTotal,
  upgradeCost,
  upgradePlaceable,
  ventConverter,
  zoneCost,
} from '../sim/sim';
import { buyableZones, parseZone, zoneName, zoneOf, zoneTileBounds } from '../sim/zones';
import { putSave } from '../net/save';
import { getHallOfFame, getSeasonRanking, HallOfFame, SeasonRanking } from '../net/rank';

type Tool =
  | 'zone'
  | 'conveyor'
  | 'node'
  | 'exporter'
  | 'converter'
  | 'storage'
  | 'upgrade'
  | 'vent'
  | 'remove';

// 설치 전 회전 순서 (R 키). 상 → 우 → 하 → 좌 → 반복.
const DIR_CYCLE: readonly Dir[] = ['N', 'E', 'S', 'W'];
const nextDir = (d: Dir): Dir => DIR_CYCLE[(DIR_CYCLE.indexOf(d) + 1) % DIR_CYCLE.length];
const DIRECTIONAL_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['conveyor', 'node', 'converter']);

const CELL = 44;
const ORIGIN_X = 190;
const ORIGIN_Y = 100;
const VIEW_AREA = 452; // 격자를 그릴 정사각 영역 (px)
const TICK_MS = 1000 / CONFIG.tickHz;
const S = CONFIG.zone.size;

const COLOR = {
  gridLine: 0xcccccc,
  zoneBg: 0xfafafa,
  zoneBorder: 0x999999,
  buyable: 0x2288cc,
  node: 0x333333,
  exporter: 0x888888,
  converter: 0x8844aa,
  storage: 0x22aa88,
  conveyor: 0xdddddd,
  conveyorActive: 0xf0c000,
  cargo: 0x2266cc,
  shutdown: 0xcc2222,
} as const;

const TOOLS: readonly Tool[] = [
  'zone',
  'conveyor',
  'node',
  'exporter',
  'converter',
  'storage',
  'upgrade',
  'vent',
  'remove',
];
const TOOL_LABEL: Record<Tool, string> = {
  zone: '구역',
  conveyor: '컨베이어',
  node: 'Node',
  exporter: 'Exporter',
  converter: 'Converter',
  storage: 'Storage',
  upgrade: '업글',
  vent: '긴급배출',
  remove: '철거',
};

type View = { minX: number; minY: number; cell: number; ox: number; oy: number };

export class FactoryScene extends Phaser.Scene {
  private sim!: SimState;
  private startSave: SimState | null = null; // 서버에서 불러온 세이브 (없으면 새 게임)
  private acc = 0;
  private tool: Tool = 'conveyor';
  private dir: Dir = 'E'; // 설치할 컨베이어/Node/Converter의 방향 (R로 회전)
  private nodeResIdx = 0; // Node 도구가 설치할 자원 인덱스 (N 키로 순환, unlockedResources 기준)
  private view: View = { minX: 0, minY: 0, cell: CELL, ox: ORIGIN_X, oy: ORIGIN_Y };

  private gfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toolButtons: Phaser.GameObjects.Text[] = [];
  private rankPanel!: Phaser.GameObjects.Text; // M5 랭킹/명예의전당 패널 (플레이스홀더 — M7 재디자인)

  constructor() {
    super('factory');
  }

  init(data: { save?: SimState | null }): void {
    this.startSave = data?.save ?? null;
  }

  create(): void {
    this.sim = this.startSave ?? initialState();
    this.gfx = this.add.graphics();

    this.hud = this.add.text(16, 16, '', {
      color: '#222',
      fontSize: '15px',
      fontFamily: 'monospace',
    });

    this.add.text(
      16,
      74,
      '[Node]검정 [Exporter]회색 [Converter]보라 [Storage]청록 · R=회전 N=자원 · 업글=Node/Storage 클릭(골드+B1) · Exporter는 자동레벨',
      { color: '#555', fontSize: '10px' },
    );

    this.statusText = this.add.text(652, 100, '', {
      color: '#333',
      fontSize: '11px',
      fontFamily: 'monospace',
      wordWrap: { width: 144 },
    });

    this.toast = this.add
      .text(400, 566, '', { color: '#c00', fontSize: '14px' })
      .setOrigin(0.5);

    TOOLS.forEach((t, i) => {
      const btn = this.add
        .text(14 + i * 82, 44, TOOL_LABEL[t], {
          color: '#111',
          backgroundColor: '#e6e6e6',
          padding: { x: 4, y: 4 },
          fontSize: '11px',
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (
          _p: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          ev: Phaser.Types.Input.EventData,
        ) => {
          ev.stopPropagation();
          this.tool = t;
          this.refreshToolButtons();
        });
      this.toolButtons.push(btn);
    });
    this.refreshToolButtons();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onGridClick(pointer));
    this.input.keyboard?.on('keydown-R', () => {
      this.dir = nextDir(this.dir);
    });
    this.input.keyboard?.on('keydown-N', () => {
      const n = this.sim.unlockedResources.length;
      this.nodeResIdx = (this.nodeResIdx + 1) % n;
    });

    // 수동 저장 버튼 (플레이스홀더 — M7 재디자인)
    this.add
      .text(700, 16, '저장', {
        color: '#111',
        backgroundColor: '#cfe8cf',
        padding: { x: 10, y: 5 },
        fontSize: '13px',
      })
      .setInteractive({ useHandCursor: true })
      .on(
        'pointerdown',
        (
          _p: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          ev: Phaser.Types.Input.EventData,
        ) => {
          ev.stopPropagation();
          void this.persist('manual');
        },
      );

    // 랭킹 버튼 + 패널 (플레이스홀더 — M7 재디자인). 클릭 시 열고/닫기 토글.
    this.add
      .text(700, 50, '랭킹', {
        color: '#111',
        backgroundColor: '#cfe0f0',
        padding: { x: 10, y: 5 },
        fontSize: '13px',
      })
      .setInteractive({ useHandCursor: true })
      .on(
        'pointerdown',
        (
          _p: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          ev: Phaser.Types.Input.EventData,
        ) => {
          ev.stopPropagation();
          void this.toggleRankPanel();
        },
      );

    this.rankPanel = this.add
      .text(190, 100, '', {
        color: '#111',
        backgroundColor: '#ffffff',
        padding: { x: 10, y: 10 },
        fontSize: '12px',
        fontFamily: 'monospace',
        wordWrap: { width: 452 },
      })
      .setDepth(10)
      .setVisible(false)
      .setInteractive({ useHandCursor: true })
      .on(
        'pointerdown',
        (
          _p: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          ev: Phaser.Types.Input.EventData,
        ) => {
          ev.stopPropagation();
          this.rankPanel.setVisible(false);
        },
      );

    // 자동 저장 (Code.md 확정: 30초 주기)
    this.time.addEvent({
      delay: CONFIG.autosaveMs,
      loop: true,
      callback: () => void this.persist('auto'),
    });

    this.computeView();
  }

  private async persist(kind: 'auto' | 'manual'): Promise<void> {
    const ok = await putSave(this.sim);
    if (kind === 'manual') {
      this.toast.setText(ok ? '저장됨' : '저장 실패 — 잠시 후 다시 시도');
    } else if (!ok) {
      this.toast.setText('자동저장 실패');
    }
  }

  private async toggleRankPanel(): Promise<void> {
    if (this.rankPanel.visible) {
      this.rankPanel.setVisible(false);
      return;
    }
    this.rankPanel.setText('불러오는 중...');
    this.rankPanel.setVisible(true);
    const [season, hof] = await Promise.all([getSeasonRanking(), getHallOfFame()]);
    if (!this.rankPanel.visible) return; // 응답 오는 동안 닫혔으면 무시
    this.rankPanel.setText(this.formatRankPanel(season, hof));
  }

  private formatRankPanel(season: SeasonRanking | null, hof: HallOfFame | null): string {
    const lines: string[] = [`[시즌 랭킹 ${season?.season ?? ''}] (클릭하면 닫힘)`];
    if (!season || season.entries.length === 0) {
      lines.push('기록 없음');
    } else {
      for (const e of season.entries) {
        lines.push(`${e.rank}위 ${e.userId}  수익 ${e.seasonRevenue}G  WAR ${e.war.toFixed(1)}`);
      }
    }
    lines.push('', '[명예의 전당]');
    const seasons = hof?.seasons ?? [];
    if (seasons.length === 0) {
      lines.push('지난 시즌 없음');
    } else {
      for (const s of seasons) {
        lines.push(s.seasonId);
        for (const e of s.entries.slice(0, 3)) {
          lines.push(`  ${e.rank}위 ${e.userId}  수익 ${e.seasonRevenue}G`);
        }
      }
    }
    return lines.join('\n');
  }

  private refreshToolButtons(): void {
    this.toolButtons.forEach((b, i) => {
      b.setBackgroundColor(TOOLS[i] === this.tool ? '#f0c000' : '#e6e6e6');
    });
  }

  // 소유 구역(+ 구역 도구일 때 구매 가능 구역)을 화면 영역에 맞춰 셀 크기·원점 계산
  private computeView(): void {
    const zids = [...this.sim.ownedZones];
    if (this.tool === 'zone') zids.push(...buyableZones(this.sim.ownedZones));
    const zx = zids.map((z) => parseZone(z)[0]);
    const zy = zids.map((z) => parseZone(z)[1]);
    const minZX = Math.min(...zx);
    const minZY = Math.min(...zy);
    const spanX = (Math.max(...zx) - minZX + 1) * S;
    const spanY = (Math.max(...zy) - minZY + 1) * S;
    const cell = Math.min(CELL, VIEW_AREA / spanX, VIEW_AREA / spanY);
    this.view = {
      minX: minZX * S,
      minY: minZY * S,
      cell,
      ox: ORIGIN_X + (VIEW_AREA - cell * spanX) / 2,
      oy: ORIGIN_Y + (VIEW_AREA - cell * spanY) / 2,
    };
  }

  private nodeResource(): string {
    const list = this.sim.unlockedResources;
    return list[this.nodeResIdx % list.length] ?? 'chip';
  }

  private onGridClick(pointer: Phaser.Input.Pointer): void {
    const v = this.view;
    const tx = v.minX + Math.floor((pointer.x - v.ox) / v.cell);
    const ty = v.minY + Math.floor((pointer.y - v.oy) / v.cell);
    const tile: Tile = [tx, ty];

    let result: PlaceResult;
    switch (this.tool) {
      case 'zone':
        result = buyZone(this.sim, zoneOf(tile));
        break;
      case 'conveyor':
        result = placeConveyor(this.sim, tile, this.dir);
        break;
      case 'node':
        result = placeBuilding(this.sim, 'node', tile, this.nodeResource(), this.dir);
        break;
      case 'exporter':
        result = placeBuilding(this.sim, 'exporter', tile);
        break;
      case 'converter':
        result = placeConverter(this.sim, tile, this.dir);
        break;
      case 'storage':
        result = placeStorage(this.sim, tile);
        break;
      case 'upgrade':
        result = upgradePlaceable(this.sim, tile);
        break;
      case 'vent':
        result = ventConverter(this.sim, tile);
        break;
      case 'remove':
        result = removePlaceable(this.sim, tile);
        break;
    }

    if (typeof result === 'string') {
      this.toast.setText(result);
    } else {
      const before = this.sim;
      this.sim = result;
      if (this.tool === 'upgrade') {
        const c = upgradeCost(before, tile);
        this.toast.setText(c ? `업그레이드 (−${c.gold}G −${c.material}${c.materialQty})` : '업그레이드됨');
      } else {
        this.toast.setText('');
      }
    }
  }

  update(_time: number, delta: number): void {
    this.acc += delta;
    let guard = 0;
    while (this.acc >= TICK_MS && guard++ < 240) {
      this.sim = step(this.sim);
      this.acc -= TICK_MS;
    }
    this.draw();
  }

  private center(t: Tile): { x: number; y: number } {
    const v = this.view;
    return {
      x: v.ox + (t[0] - v.minX) * v.cell + v.cell / 2,
      y: v.oy + (t[1] - v.minY) * v.cell + v.cell / 2,
    };
  }

  // 타일 중앙에 진행 방향을 가리키는 작은 삼각형
  private drawDirTriangle(cx: number, cy: number, d: Dir, color: number, size: number): void {
    const [dx, dy] = DIR_VEC[d];
    const h = size;
    const tip = { x: cx + dx * h, y: cy + dy * h };
    const back = { x: cx - dx * h, y: cy - dy * h };
    const perp = { x: -dy * h, y: dx * h };
    this.gfx.fillStyle(color, 1);
    this.gfx.fillTriangle(
      tip.x,
      tip.y,
      back.x + perp.x,
      back.y + perp.y,
      back.x - perp.x,
      back.y - perp.y,
    );
  }

  private drawZoneGrid(): void {
    const g = this.gfx;
    const v = this.view;

    for (const zid of this.sim.ownedZones) {
      const [bx, by] = zoneTileBounds(zid);
      const c = this.center([bx, by]);
      const x0 = c.x - v.cell / 2;
      const y0 = c.y - v.cell / 2;
      const w = S * v.cell;
      g.fillStyle(COLOR.zoneBg, 1);
      g.fillRect(x0, y0, w, w);
      g.lineStyle(1, COLOR.gridLine, 1);
      for (let i = 0; i <= S; i++) {
        g.lineBetween(x0 + i * v.cell, y0, x0 + i * v.cell, y0 + w);
        g.lineBetween(x0, y0 + i * v.cell, x0 + w, y0 + i * v.cell);
      }
      g.lineStyle(2, COLOR.zoneBorder, 1);
      g.strokeRect(x0, y0, w, w);
    }

    if (this.tool === 'zone') {
      g.lineStyle(2, COLOR.buyable, 1);
      for (const zid of buyableZones(this.sim.ownedZones)) {
        const [bx, by] = zoneTileBounds(zid);
        const c = this.center([bx, by]);
        const w = S * v.cell;
        g.strokeRect(c.x - v.cell / 2 + 3, c.y - v.cell / 2 + 3, w - 6, w - 6);
      }
    }
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    this.computeView();
    const v = this.view;
    const tri = Math.max(4, v.cell * 0.16);
    const inset = Math.max(1, v.cell * 0.08);

    this.drawZoneGrid();

    // 가동 중인(막히지 않은) 경로의 컨베이어 타일 집합
    const routes = computeRoutes(this.sim.placeables);
    const activeTiles = new Set<string>();
    for (const route of routes.values()) {
      if (route.sink === 'blocked') continue;
      route.path.slice(0, -1).forEach((t) => activeTiles.add(`${t[0]},${t[1]}`));
    }

    const shut = shutdownInfo(this.sim);
    const stopped = stoppedPlaceables(this.sim);

    for (const p of this.sim.placeables) {
      const c = this.center(p.tile);
      const box = v.cell - inset * 2;
      if (p.kind === 'conveyor') {
        const on = activeTiles.has(`${p.tile[0]},${p.tile[1]}`) && !stopped.has(p.id);
        g.fillStyle(on ? COLOR.conveyorActive : COLOR.conveyor, 1);
        g.fillRect(c.x - box / 2, c.y - box / 2, box, box);
        this.drawDirTriangle(c.x, c.y, p.dir, 0x222222, tri);
      } else if (p.kind === 'node') {
        g.fillStyle(stopped.has(p.id) ? COLOR.shutdown : COLOR.node, 1);
        g.fillRect(c.x - box / 2, c.y - box / 2, box, box);
        this.drawDirTriangle(c.x, c.y, p.dir, 0xffffff, tri);
      } else if (p.kind === 'converter') {
        g.fillStyle(COLOR.converter, 1);
        g.fillRect(c.x - box / 2, c.y - box / 2, box, box);
        this.drawDirTriangle(c.x, c.y, p.dir, 0xffffff, tri);
        if (shut[p.id]) {
          g.lineStyle(3, COLOR.shutdown, 1);
          g.strokeRect(c.x - v.cell / 2 + 1, c.y - v.cell / 2 + 1, v.cell - 2, v.cell - 2);
        }
      } else if (p.kind === 'storage') {
        g.fillStyle(COLOR.storage, 1);
        g.fillRect(c.x - box / 2, c.y - box / 2, box, box);
      } else {
        g.fillStyle(COLOR.exporter, 1);
        g.fillRect(c.x - box / 2, c.y - box / 2, box, box);
      }
    }

    const perTile = gradeToTicks(10, CONFIG.tickHz);
    g.fillStyle(COLOR.cargo, 1);
    for (const cargo of this.sim.cargo) {
      const src = this.sim.placeables.find((p) => p.id === cargo.sourceId);
      if (!src) continue;
      const path = findPath(this.sim.placeables, src);
      if (!path || cargo.index >= path.length) continue;
      const from = cargo.index === 0 ? src.tile : path[cargo.index - 1];
      const to = path[cargo.index];
      const a = this.center(from);
      const b = this.center(to);
      const k = Math.min(1, cargo.ticksOnTile / perTile);
      g.fillCircle(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, Math.max(2, v.cell * 0.11));
    }

    this.drawStatusText(shut);

    const dirHint = DIRECTIONAL_TOOLS.has(this.tool) ? `  방향 [${DIR_ARROW[this.dir]}]` : '';
    const nodeHint = this.tool === 'node' ? `  자원 [${this.nodeResource()}]` : '';
    const locked = !this.sim.unlockedResources.includes('A1');
    const unlockHint = locked
      ? `  칩판매 ${this.sim.chipSold}/${CONFIG.resourceUnlockChips}`
      : '';
    this.hud.setText(
      `골드 ${this.sim.gold}G   구역 ${this.sim.ownedZones.length}개${unlockHint}   도구 [${this.tool}]${dirHint}${nodeHint}`,
    );
  }

  // 우측 상태판 (플레이스홀더 텍스트, M7 재디자인)
  private drawStatusText(shut: Record<string, { resources: string[]; weight: number }>): void {
    const s = this.sim;
    const lines: string[] = [];

    if (this.tool === 'zone') {
      const buyable = buyableZones(s.ownedZones);
      lines.push(`[구역] 다음 확장 ${zoneCost(s)}G`);
      lines.push(buyable.length ? `구매가능: ${buyable.map(zoneName).join(' ')}` : '더 살 구역 없음');
      lines.push('');
    }

    for (const p of s.placeables) {
      if (p.kind === 'node') {
        const lv = s.nodeLevel[p.id] ?? 1;
        lines.push(`[N] ${p.id} Lv${lv} (${RESOURCES[p.resource]?.name ?? p.resource})`);
      } else if (p.kind === 'converter') {
        const bl = s.converterBacklog[p.id] ?? {};
        const parts = Object.entries(bl).map(([r, n]) => `${RESOURCES[r]?.name ?? r}x${n}`);
        const sd = shut[p.id];
        lines.push(
          `[C] ${p.id}\n  재고 ${parts.length ? parts.join(' ') : '없음'}` +
            (sd
              ? `\n  * 셧다운 (${sd.resources
                  .map((r) => RESOURCES[r]?.name ?? r)
                  .join(',')} 과잉, 무게 ${sd.weight})`
              : ''),
        );
      } else if (p.kind === 'storage') {
        const lv = s.storageLevel[p.id] ?? 1;
        const contents = Object.entries(s.storage[p.id] ?? {})
          .filter(([, n]) => n > 0)
          .map(([r, n]) => `${RESOURCES[r]?.name ?? r}x${n}`)
          .join(' ');
        lines.push(
          `[S] ${p.id} Lv${lv}\n  ${storageTotal(s, p.id)}/${storageCap(lv)}${contents ? ' · ' + contents : ''}`,
        );
      } else if (p.kind === 'exporter') {
        const lv = s.exporterLevel[p.id] ?? 1;
        const prog = s.exporterProgress[p.id] ?? 0;
        lines.push(`[E] ${p.id} Lv${lv} (+${Math.round((lv - 1) * 10)}%, ${prog}/${10 * lv})`);
      }
    }
    this.statusText.setText(lines.join('\n'));
  }
}
