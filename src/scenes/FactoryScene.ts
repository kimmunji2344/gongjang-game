// M7 디자인 개편 — 렌더(캔버스: 격자·설비·화물)는 Phaser, HUD·팝업은 전부 DOM(src/ui/hud.ts, popup.ts).
// 자원/가공품 개별 아이콘 디자인은 자원 도감 완성 후로 보류 — 지금은 설비/타일/UI만 교체.
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { RESOURCES } from '../data/resources';
import { gradeToTicks } from '../data/speed';
import { DIR_VEC, Dir, Tile, placeableAt } from '../sim/grid';
import { currentDayId } from '../sim/day';
import {
  HintId,
  PlaceResult,
  SimState,
  buyZone,
  checkHint,
  computeRoutes,
  conveyorGrade,
  findPath,
  fulfillNpcQuest,
  initialState,
  placeBuilding,
  placeConverter,
  placeConveyor,
  placeStorage,
  refreshNpcQuest,
  removePlaceable,
  rotatePlaceable,
  shutdownInfo,
  step,
  stoppedPlaceables,
  upgradeCost,
  upgradePlaceable,
  ventConverter,
} from '../sim/sim';
import { buyableZones, parseZone, zoneOf, zoneTileBounds } from '../sim/zones';
import { putSave } from '../net/save';
import { getHallOfFame, getSeasonRanking } from '../net/rank';
import { logOut } from '../ui/screens';
import { closePopup, showToast } from '../ui/popup';
import {
  Tool,
  mountHud,
  openCodexPopup,
  openDirectionPopup,
  openNpcPopup,
  openRankLoadingPopup,
  openRankPopup,
  openSettingsPopup,
  openShutdownPopup,
  openStoragePopup,
  openUpgradePopup,
  setActiveTool,
  updateNpcBadge,
  updateSidebar,
  updateToolInfo,
  updateTopStats,
} from '../ui/hud';

const LONG_PRESS_MS = 500; // 2026-09-17 확정: 짧게 클릭=회전, 길게 누르면 방향 선택
const DIR_CYCLE: readonly Dir[] = ['N', 'E', 'S', 'W'];
const nextDir = (d: Dir): Dir => DIR_CYCLE[(DIR_CYCLE.indexOf(d) + 1) % DIR_CYCLE.length];
// 이미 설치된 타일 위에 이 도구들로 클릭하면 "설치 실패" 대신 안내 팝업을 띄운다.
const PLACEMENT_TOOLS: ReadonlySet<Tool> = new Set<Tool>([
  'zone',
  'conveyor',
  'node',
  'exporter',
  'converter',
  'storage',
]);
const ROTATABLE = new Set(['node', 'conveyor', 'converter']);

const CELL = 44;
const ORIGIN_X = 190;
const ORIGIN_Y = 20;
const VIEW_AREA = 452;
const TICK_MS = 1000 / CONFIG.tickHz;
const S = CONFIG.zone.size;

// 동물의숲류 파스텔 팔레트 (흑백 베이스 + 파스텔 포인트). 자원 아이콘 자체는 아직 플레이스홀더.
const COLOR = {
  ink: 0x4a4744,
  gridLine: 0xe8e0d0,
  zoneBg: 0xfbf8f2,
  zoneBorder: 0xdcd2ba,
  buyable: 0x7fbcdd,
  node: 0x8fd1b3,
  exporter: 0xf3ac82,
  converter: 0xc3aeea,
  storage: 0xecd066,
  conveyor: 0xe4ddce,
  conveyorActive: 0xf6d97c,
  cargo: 0xec99b3,
  shutdown: 0xe17b7b,
} as const;

type View = { minX: number; minY: number; cell: number; ox: number; oy: number };

export class FactoryScene extends Phaser.Scene {
  private sim!: SimState;
  private startSave: SimState | null = null;
  private acc = 0;
  private tool: Tool = 'conveyor';
  private dir: Dir = 'E';
  private nodeResIdx = 0;
  private view: View = { minX: 0, minY: 0, cell: CELL, ox: ORIGIN_X, oy: ORIGIN_Y };
  private gfx!: Phaser.GameObjects.Graphics;
  private rotateDownAt: { tile: Tile; time: number } | null = null;

  constructor() {
    super('factory');
  }

  init(data: { save?: SimState | null }): void {
    this.startSave = data?.save ?? null;
  }

  create(): void {
    this.sim = this.startSave ?? initialState();
    this.gfx = this.add.graphics();

    mountHud({
      onTool: (t) => {
        this.tool = t;
        this.rotateDownAt = null;
        setActiveTool(t);
        if (t === 'converter') {
          this.applyHint(
            'converter',
            true,
            'Converter는 서로 다른 자원 2종 이상을 입력받아야 가공을 시작합니다',
          );
        }
      },
      onSave: () => void this.persist('manual'),
      onRank: () => void this.openRank(),
      onCodex: () => openCodexPopup(this.sim),
      onNpc: () => openNpcPopup(this.sim, () => this.handInNpc()),
      onSettings: () =>
        openSettingsPopup(
          () => {
            logOut();
            window.location.reload();
          },
          () => void this.persist('manual'),
        ),
    });
    setActiveTool(this.tool);

    this.applyHint('start', true, '이 둘을 이어보세요! (Node → Exporter, 컨베이어로 연결)');

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.tool === 'rotate') {
        this.rotateDownAt = { tile: this.tileFromPointer(pointer), time: this.time.now };
        return;
      }
      this.onGridClick(pointer);
    });
    this.input.on('pointerup', () => {
      if (this.tool !== 'rotate' || !this.rotateDownAt) return;
      const { tile, time } = this.rotateDownAt;
      this.rotateDownAt = null;
      if (this.time.now - time >= LONG_PRESS_MS) {
        this.startDirectionPick(tile);
      } else {
        this.rotateOneStep(tile);
      }
    });
    this.input.keyboard?.on('keydown-R', () => {
      this.dir = nextDir(this.dir);
    });
    this.input.keyboard?.on('keydown-N', () => {
      const n = this.sim.unlockedResources.length;
      this.nodeResIdx = (this.nodeResIdx + 1) % n;
    });

    this.time.addEvent({
      delay: CONFIG.autosaveMs,
      loop: true,
      callback: () => void this.persist('auto'),
    });

    this.computeView();
  }

  private async persist(kind: 'auto' | 'manual'): Promise<void> {
    const ok = await putSave(this.sim);
    if (kind === 'manual') showToast(ok ? '저장됨' : '저장 실패 — 잠시 후 다시 시도', ok ? 'ok' : 'bad');
    else if (!ok) showToast('자동저장 실패', 'bad');
  }

  private async openRank(): Promise<void> {
    openRankLoadingPopup();
    const [season, hof] = await Promise.all([getSeasonRanking(), getHallOfFame()]);
    openRankPopup(season, hof);
  }

  private handInNpc(): void {
    const r = fulfillNpcQuest(this.sim);
    if (typeof r === 'string') showToast(r, 'bad');
    else {
      this.sim = r;
      showToast('NPC 퀘스트 완료! 보상 지급됨');
    }
  }

  private doVent(tile: Tile): void {
    const r = ventConverter(this.sim, tile);
    if (typeof r === 'string') showToast(r, 'bad');
    else {
      this.sim = r;
      showToast('긴급배출 완료');
      closePopup();
    }
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

  private tileFromPointer(pointer: Phaser.Input.Pointer): Tile {
    const v = this.view;
    const tx = v.minX + Math.floor((pointer.x - v.ox) / v.cell);
    const ty = v.minY + Math.floor((pointer.y - v.oy) / v.cell);
    return [tx, ty];
  }

  private onGridClick(pointer: Phaser.Input.Pointer): void {
    const tile = this.tileFromPointer(pointer);
    const existing = placeableAt(this.sim.placeables, tile);

    // 이미 설치된 타일을 배치 도구로 클릭 = 배치 실패 토스트 대신 안내 팝업 (창고/셧다운 상세)
    if (existing && PLACEMENT_TOOLS.has(this.tool)) {
      if (existing.kind === 'storage') {
        openStoragePopup(this.sim, existing.id);
        return;
      }
      if (existing.kind === 'converter') {
        const info = shutdownInfo(this.sim)[existing.id];
        if (info) {
          openShutdownPopup(info, () => this.doVent(tile));
          return;
        }
      }
    }

    if (this.tool === 'upgrade') {
      this.openUpgrade(tile);
      return;
    }

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
      case 'vent':
        result = ventConverter(this.sim, tile);
        break;
      case 'remove':
        result = removePlaceable(this.sim, tile);
        break;
      case 'rotate':
        return; // pointerdown/up 에서 길이를 재서 별도 처리 — 여기로는 오지 않음(안전망)
    }

    if (typeof result === 'string') showToast(result, 'bad');
    else {
      this.sim = result;
      showToast('');
    }
  }

  private openUpgrade(tile: Tile): void {
    const p = placeableAt(this.sim.placeables, tile);
    if (!p) {
      showToast('설치물이 없습니다', 'bad');
      return;
    }
    if (p.kind === 'exporter') {
      showToast('Exporter 는 자동 레벨업입니다', 'bad');
      return;
    }
    const level =
      p.kind === 'node'
        ? this.sim.nodeLevel[p.id] ?? 1
        : p.kind === 'storage'
          ? this.sim.storageLevel[p.id] ?? 1
          : this.sim.conveyorLevel[p.id] ?? 1;
    const kindLabel = p.kind === 'node' ? 'Node' : p.kind === 'storage' ? 'Storage' : '컨베이어';
    const cost = level >= CONFIG.maxLevel ? null : upgradeCost(this.sim, tile);
    openUpgradePopup(kindLabel, level, cost, () => {
      const result = upgradePlaceable(this.sim, tile);
      if (typeof result === 'string') showToast(result, 'bad');
      else {
        this.sim = result;
        showToast('업그레이드 완료!');
      }
    });
  }

  private applyRotate(tile: Tile, dir: Dir): void {
    const result = rotatePlaceable(this.sim, tile, dir);
    if (typeof result === 'string') showToast(result, 'bad');
    else {
      this.sim = result;
      showToast('');
    }
  }

  private rotateOneStep(tile: Tile): void {
    const p = placeableAt(this.sim.placeables, tile);
    if (!p || !ROTATABLE.has(p.kind)) {
      showToast('방향이 없는 설비입니다', 'bad');
      return;
    }
    this.applyRotate(tile, nextDir((p as { dir: Dir }).dir));
  }

  private startDirectionPick(tile: Tile): void {
    const p = placeableAt(this.sim.placeables, tile);
    if (!p || !ROTATABLE.has(p.kind)) {
      showToast('방향이 없는 설비입니다', 'bad');
      return;
    }
    openDirectionPopup((dir) => this.applyRotate(tile, dir));
  }

  update(_time: number, delta: number): void {
    this.sim = refreshNpcQuest(this.sim, currentDayId());

    this.acc += delta;
    let guard = 0;
    while (this.acc >= TICK_MS && guard++ < 240) {
      this.sim = step(this.sim);
      this.acc -= TICK_MS;
    }

    this.applyHint(
      'shutdown',
      Object.keys(shutdownInfo(this.sim)).length > 0,
      '재고가 가득 찼습니다! 긴급배출(무료)로 즉시 해제하거나, Storage 로 우회해보세요',
    );

    this.draw();
  }

  private center(t: Tile): { x: number; y: number } {
    const v = this.view;
    return {
      x: v.ox + (t[0] - v.minX) * v.cell + v.cell / 2,
      y: v.oy + (t[1] - v.minY) * v.cell + v.cell / 2,
    };
  }

  private drawDirTriangle(cx: number, cy: number, d: Dir, size: number): void {
    const [dx, dy] = DIR_VEC[d];
    const h = size;
    const tip = { x: cx + dx * h, y: cy + dy * h };
    const back = { x: cx - dx * h, y: cy - dy * h };
    const perp = { x: -dy * h, y: dx * h };
    this.gfx.fillStyle(COLOR.ink, 0.75);
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
      g.fillRoundedRect(x0, y0, w, w, Math.min(14, v.cell * 0.3));
      g.lineStyle(1, COLOR.gridLine, 1);
      for (let i = 1; i < S; i++) {
        g.lineBetween(x0 + i * v.cell, y0, x0 + i * v.cell, y0 + w);
        g.lineBetween(x0, y0 + i * v.cell, x0 + w, y0 + i * v.cell);
      }
      g.lineStyle(2, COLOR.zoneBorder, 1);
      g.strokeRoundedRect(x0, y0, w, w, Math.min(14, v.cell * 0.3));
    }

    if (this.tool === 'zone') {
      g.lineStyle(3, COLOR.buyable, 1);
      for (const zid of buyableZones(this.sim.ownedZones)) {
        const [bx, by] = zoneTileBounds(zid);
        const c = this.center([bx, by]);
        const w = S * v.cell;
        g.strokeRoundedRect(
          c.x - v.cell / 2 + 3,
          c.y - v.cell / 2 + 3,
          w - 6,
          w - 6,
          Math.min(12, v.cell * 0.28),
        );
      }
    }
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    this.computeView();
    const v = this.view;
    const tri = Math.max(4, v.cell * 0.16);
    const inset = Math.max(1, v.cell * 0.1);
    const radius = Math.min(10, v.cell * 0.26);

    this.drawZoneGrid();

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
        g.fillRoundedRect(c.x - box / 2, c.y - box / 2, box, box, radius);
        this.drawDirTriangle(c.x, c.y, p.dir, tri);
      } else if (p.kind === 'node') {
        g.fillStyle(stopped.has(p.id) ? COLOR.shutdown : COLOR.node, 1);
        g.fillRoundedRect(c.x - box / 2, c.y - box / 2, box, box, radius);
        this.drawDirTriangle(c.x, c.y, p.dir, tri);
      } else if (p.kind === 'converter') {
        g.fillStyle(COLOR.converter, 1);
        g.fillRoundedRect(c.x - box / 2, c.y - box / 2, box, box, radius);
        this.drawDirTriangle(c.x, c.y, p.dir, tri);
        if (shut[p.id]) {
          g.lineStyle(3, COLOR.shutdown, 1);
          g.strokeRoundedRect(c.x - v.cell / 2 + 1, c.y - v.cell / 2 + 1, v.cell - 2, v.cell - 2, radius);
        }
      } else if (p.kind === 'storage') {
        g.fillStyle(COLOR.storage, 1);
        g.fillRoundedRect(c.x - box / 2, c.y - box / 2, box, box, radius);
      } else {
        g.fillStyle(COLOR.exporter, 1);
        g.fillRoundedRect(c.x - box / 2, c.y - box / 2, box, box, radius);
      }
    }

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
      const tileConveyor = placeableAt(this.sim.placeables, to);
      const level = tileConveyor ? this.sim.conveyorLevel[tileConveyor.id] ?? 1 : 1;
      const perTile = gradeToTicks(conveyorGrade(level), CONFIG.tickHz);
      const k = Math.min(1, cargo.ticksOnTile / perTile);
      g.fillCircle(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, Math.max(2, v.cell * 0.11));
    }

    updateTopStats(this.sim);
    updateToolInfo(this.tool, this.dir, RESOURCES[this.nodeResource()]?.name ?? null);
    updateSidebar(this.sim, shut, (tile) => this.doVent(tile));
    updateNpcBadge(this.sim, () => openNpcPopup(this.sim, () => this.handInNpc()));
  }

  private applyHint(id: HintId, active: boolean, text: string): void {
    const [next, shown] = checkHint(this.sim, id, active);
    this.sim = next;
    if (shown) showToast(text);
  }
}
