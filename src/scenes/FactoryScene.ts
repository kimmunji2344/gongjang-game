// M1~M2 렌더 + 입력. 그래픽은 전부 플레이스홀더 (M7에서 일괄 교체 예정).
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { RESOURCES } from '../data/resources';
import { gradeToTicks } from '../data/speed';
import { DIR_ARROW, DIR_VEC, Dir, Tile } from '../sim/grid';
import {
  PlaceResult,
  SimState,
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
  ventConverter,
} from '../sim/sim';
import { putSave } from '../net/save';

type Tool = 'conveyor' | 'node' | 'exporter' | 'converter' | 'storage' | 'vent' | 'remove';

// 설치 전 회전 순서 (R 키). 상 → 우 → 하 → 좌 → 반복.
const DIR_CYCLE: readonly Dir[] = ['N', 'E', 'S', 'W'];
const nextDir = (d: Dir): Dir => DIR_CYCLE[(DIR_CYCLE.indexOf(d) + 1) % DIR_CYCLE.length];
const DIRECTIONAL_TOOLS: ReadonlySet<Tool> = new Set<Tool>(['conveyor', 'node', 'converter']);

const CELL = 44;
const ORIGIN_X = 190;
const ORIGIN_Y = 100;
const TICK_MS = 1000 / CONFIG.tickHz;

const COLOR = {
  gridLine: 0xcccccc,
  node: 0x333333,
  exporter: 0x888888,
  converter: 0x8844aa,
  storage: 0x22aa88,
  conveyor: 0xdddddd,
  conveyorActive: 0xf0c000,
  cargo: 0x2266cc,
  shutdown: 0xcc2222,
} as const;

// M2 임시: Node 도구가 설치할 자원을 N 키로 순환 (칩 → A1 → A2)
const NODE_RESOURCES: readonly string[] = ['chip', 'A1', 'A2'];

const TOOLS: readonly Tool[] = [
  'conveyor',
  'node',
  'exporter',
  'converter',
  'storage',
  'vent',
  'remove',
];
const TOOL_LABEL: Record<Tool, string> = {
  conveyor: '컨베이어',
  node: 'Node',
  exporter: 'Exporter',
  converter: 'Converter',
  storage: 'Storage',
  vent: '긴급배출',
  remove: '철거',
};

export class FactoryScene extends Phaser.Scene {
  private sim!: SimState;
  private startSave: SimState | null = null; // 서버에서 불러온 세이브 (없으면 새 게임)
  private acc = 0;
  private tool: Tool = 'conveyor';
  private dir: Dir = 'E'; // 설치할 컨베이어/Node/Converter의 방향 (R로 회전)
  private nodeResIdx = 0; // Node 도구가 설치할 자원 (N 키로 순환)

  private gfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toolButtons: Phaser.GameObjects.Text[] = [];

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
      '[Node] 검정  [Exporter] 회색  [Converter] 보라  [Storage] 청록  ·  R = 방향 회전  ·  N = Node 자원  ·  설치/철거비 10G',
      { color: '#555', fontSize: '11px' },
    );

    this.statusText = this.add.text(636, 100, '', {
      color: '#333',
      fontSize: '11px',
      fontFamily: 'monospace',
      wordWrap: { width: 160 },
    });

    this.toast = this.add
      .text(400, 566, '', { color: '#c00', fontSize: '14px' })
      .setOrigin(0.5);

    TOOLS.forEach((t, i) => {
      const btn = this.add
        .text(16 + i * 96, 44, TOOL_LABEL[t], {
          color: '#111',
          backgroundColor: '#e6e6e6',
          padding: { x: 6, y: 4 },
          fontSize: '12px',
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
      this.nodeResIdx = (this.nodeResIdx + 1) % NODE_RESOURCES.length;
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

    // 자동 저장 (Code.md 확정: 30초 주기)
    this.time.addEvent({
      delay: CONFIG.autosaveMs,
      loop: true,
      callback: () => void this.persist('auto'),
    });
  }

  private async persist(kind: 'auto' | 'manual'): Promise<void> {
    const ok = await putSave(this.sim);
    if (kind === 'manual') {
      this.toast.setText(ok ? '저장됨' : '저장 실패 — 잠시 후 다시 시도');
    } else if (!ok) {
      this.toast.setText('자동저장 실패');
    }
  }

  private refreshToolButtons(): void {
    this.toolButtons.forEach((b, i) => {
      b.setBackgroundColor(TOOLS[i] === this.tool ? '#f0c000' : '#e6e6e6');
    });
  }

  private onGridClick(pointer: Phaser.Input.Pointer): void {
    const tx = Math.floor((pointer.x - ORIGIN_X) / CELL);
    const ty = Math.floor((pointer.y - ORIGIN_Y) / CELL);
    if (tx < 0 || ty < 0 || tx >= CONFIG.grid.w || ty >= CONFIG.grid.h) return;
    const tile: Tile = [tx, ty];

    let result: PlaceResult;
    switch (this.tool) {
      case 'conveyor':
        result = placeConveyor(this.sim, tile, this.dir);
        break;
      case 'node':
        result = placeBuilding(this.sim, 'node', tile, NODE_RESOURCES[this.nodeResIdx], this.dir);
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
    }

    if (typeof result === 'string') {
      this.toast.setText(result);
    } else {
      this.sim = result;
      this.toast.setText('');
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
    return {
      x: ORIGIN_X + t[0] * CELL + CELL / 2,
      y: ORIGIN_Y + t[1] * CELL + CELL / 2,
    };
  }

  // 타일 중앙에 진행 방향을 가리키는 작은 삼각형
  private drawDirTriangle(cx: number, cy: number, d: Dir, color: number): void {
    const [dx, dy] = DIR_VEC[d];
    const h = 7;
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

  private draw(): void {
    const g = this.gfx;
    g.clear();

    g.lineStyle(1, COLOR.gridLine, 1);
    for (let x = 0; x <= CONFIG.grid.w; x++) {
      const px = ORIGIN_X + x * CELL;
      g.lineBetween(px, ORIGIN_Y, px, ORIGIN_Y + CONFIG.grid.h * CELL);
    }
    for (let y = 0; y <= CONFIG.grid.h; y++) {
      const py = ORIGIN_Y + y * CELL;
      g.lineBetween(ORIGIN_X, py, ORIGIN_X + CONFIG.grid.w * CELL, py);
    }

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
      if (p.kind === 'conveyor') {
        const on = activeTiles.has(`${p.tile[0]},${p.tile[1]}`) && !stopped.has(p.id);
        g.fillStyle(on ? COLOR.conveyorActive : COLOR.conveyor, 1);
        g.fillRect(c.x - CELL / 2 + 4, c.y - CELL / 2 + 4, CELL - 8, CELL - 8);
        this.drawDirTriangle(c.x, c.y, p.dir, 0x222222);
      } else if (p.kind === 'node') {
        g.fillStyle(stopped.has(p.id) ? COLOR.shutdown : COLOR.node, 1);
        g.fillRect(c.x - CELL / 2 + 2, c.y - CELL / 2 + 2, CELL - 4, CELL - 4);
        this.drawDirTriangle(c.x, c.y, p.dir, 0xffffff);
      } else if (p.kind === 'converter') {
        g.fillStyle(COLOR.converter, 1);
        g.fillRect(c.x - CELL / 2 + 2, c.y - CELL / 2 + 2, CELL - 4, CELL - 4);
        this.drawDirTriangle(c.x, c.y, p.dir, 0xffffff);
        if (shut[p.id]) {
          g.lineStyle(3, COLOR.shutdown, 1);
          g.strokeRect(c.x - CELL / 2 + 1, c.y - CELL / 2 + 1, CELL - 2, CELL - 2);
        }
      } else if (p.kind === 'storage') {
        g.fillStyle(COLOR.storage, 1);
        g.fillRect(c.x - CELL / 2 + 2, c.y - CELL / 2 + 2, CELL - 4, CELL - 4);
      } else {
        g.fillStyle(COLOR.exporter, 1);
        g.fillRect(c.x - CELL / 2 + 2, c.y - CELL / 2 + 2, CELL - 4, CELL - 4);
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
      g.fillCircle(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 5);
    }

    this.drawStatusText(shut);

    const dirHint = DIRECTIONAL_TOOLS.has(this.tool) ? `  방향 [${DIR_ARROW[this.dir]}]` : '';
    const nodeHint = this.tool === 'node' ? `  자원 [${NODE_RESOURCES[this.nodeResIdx]}]` : '';
    this.hud.setText(`골드 ${this.sim.gold}G   도구 [${this.tool}]${dirHint}${nodeHint}`);
  }

  // 우측: Converter 재고 / Storage 적재 상태 (플레이스홀더 텍스트, M7 재디자인)
  private drawStatusText(shut: Record<string, { resources: string[]; weight: number }>): void {
    const lines: string[] = [];
    for (const p of this.sim.placeables) {
      if (p.kind === 'converter') {
        const bl = this.sim.converterBacklog[p.id] ?? {};
        const parts = Object.entries(bl).map(([r, n]) => `${RESOURCES[r]?.name ?? r}x${n}`);
        const s = shut[p.id];
        lines.push(
          `[C] ${p.id}\n  재고 ${parts.length ? parts.join(' ') : '없음'}` +
            (s
              ? `\n  * 셧다운 (${s.resources
                  .map((r) => RESOURCES[r]?.name ?? r)
                  .join(',')} 과잉, 무게 ${s.weight})`
              : ''),
        );
      } else if (p.kind === 'storage') {
        lines.push(`[S] ${p.id}\n  ${this.sim.storage[p.id] ?? 0}/${CONFIG.storageCapacity}`);
      }
    }
    this.statusText.setText(lines.join('\n'));
  }
}
