// 로그인 통과 후 호출. Phaser를 여기서 동적 import → 메뉴/로그인 단계에선 Phaser 번들이 로드되지 않음.
import type { SimState } from './sim/sim';

export async function startFactory(userId: string, save: SimState | null): Promise<void> {
  const [{ default: Phaser }, { FactoryScene }] = await Promise.all([
    import('phaser'),
    import('./scenes/FactoryScene'),
  ]);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: 800,
    height: 600,
    backgroundColor: '#f2f2f2',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });

  // 세이브(있으면)를 씬에 넘겨 자동 시작
  game.scene.add('factory', FactoryScene, true, { save });

  // 개발 편의 (디버깅용, M7에서 제거)
  Object.assign(window as unknown as Record<string, unknown>, { game, userId });
}
