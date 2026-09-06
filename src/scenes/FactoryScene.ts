// M1 렌더 + 입력. 그래픽은 전부 플레이스홀더 (M7에서 일괄 교체 예정).
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { gradeToTicks } from '../data/speed';
import { Tile } from '../sim/grid';
import {
  PlaceResult,
  SimState,
  findPath,
  initialState,
  placeBuilding,
  placeConveyor,
  removePlaceable,
  step,
} from '../sim/sim';

type Tool = 'conveyor' | 'node' | 'exporter' | 'remove';

const CELL = 44;
const ORIGIN_X = 190;
const ORIGIN_Y = 100;
const TICK_MS = 1000 / CONFIG.tickHz;

const COLOR = {
  gridLine: 0xcccccc,
  node: 0x333333,
  exporter: 0x888888,
  conveyor: 0xdddddd,
  conveyorActive: 0xf0c000,
  cargo: 0x2266cc,
} as const;

const TOOLS: readonly Tool[] = ['conveyor', 'node', 'exporter', 'remove'];
const TOOL_LABEL: Record<Tool, string> = {
  conveyor: '컨베이어(10G)',
  node: 'Node(10G)',
  exporter: 'Exporter(10G)',
  remove: '철거',
};

export class FactoryScene extends Phaser.Scene {
  private sim!: SimState;
  private acc = 0;
  private tool: Tool = 'conveyor';

  private gfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private toolButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('factory');
  }

  create(): void {
    this.sim = initialState();
    this.gfx = this.add.graphics();

    this.hud = this.add.text(16, 16, '', {
      color: '#222',
      fontSize: '15px',
      fontFamily: 'monospace',
    });

    this.add.text(16, 74, '[Node] 검정  [Exporter] 회색  [컨베이어] 노랑=가동  [자원] 파란 점', {
      color: '#555',
      fontSize: '12px',
    });

    this.toast = this.add
      .text(400, 566, '', { color: '#c00', fontSize: '14px' })
      .setOrigin(0.5);

    TOOLS.forEach((t, i) => {
      const btn = this.add
        .text(16 + i * 128, 44, TOOL_LABEL[t], {
          color: '#111',
          backgroundColor: '#e6e6e6',
          padding: { x: 8, y: 4 },
          fontSize: '13px',
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
        result = placeConveyor(this.sim, tile);
        break;
      case 'node':
        result = placeBuilding(this.sim, 'node', tile, 'chip');
        break;
      case 'exporter':
        result = placeBuilding(this.sim, 'exporter', tile);
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

    // 가동 중인 컨베이어 타일 집합
    const activeTiles = new Set<string>();
    for (const p of this.sim.placeables) {
      if (p.kind !== 'node') continue;
      const path = findPath(this.sim.placeables, p);
      if (path) path.slice(0, -1).forEach((t) => activeTiles.add(`${t[0]},${t[1]}`));
    }

    for (const p of this.sim.placeables) {
      const c = this.center(p.tile);
      if (p.kind === 'conveyor') {
        const on = activeTiles.has(`${p.tile[0]},${p.tile[1]}`);
        g.fillStyle(on ? COLOR.conveyorActive : COLOR.conveyor, 1);
        g.fillRect(c.x - CELL / 2 + 4, c.y - CELL / 2 + 4, CELL - 8, CELL - 8);
      } else {
        g.fillStyle(p.kind === 'node' ? COLOR.node : COLOR.exporter, 1);
        g.fillRect(c.x - CELL / 2 + 2, c.y - CELL / 2 + 2, CELL - 4, CELL - 4);
      }
    }

    const perTile = gradeToTicks(10, CONFIG.tickHz);
    g.fillStyle(COLOR.cargo, 1);
    for (const cargo of this.sim.cargo) {
      const node = this.sim.placeables.find((p) => p.id === cargo.nodeId);
      if (!node) continue;
      const path = findPath(this.sim.placeables, node);
      if (!path || cargo.index >= path.length) continue;
      const from = cargo.index === 0 ? node.tile : path[cargo.index - 1];
      const to = path[cargo.index];
      const a = this.center(from);
      const b = this.center(to);
      const k = Math.min(1, cargo.ticksOnTile / perTile);
      g.fillCircle(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 5);
    }

    this.hud.setText(
      `골드 ${this.sim.gold}G    틱 ${this.sim.tick}    무료 컨베이어 ${this.sim.freeConveyors}    도구 [${this.tool}]`,
    );
  }
}
