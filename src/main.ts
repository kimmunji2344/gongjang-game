import Phaser from 'phaser';
import { FactoryScene } from './scenes/FactoryScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 800,
  height: 600,
  backgroundColor: '#f2f2f2',
  scene: [FactoryScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

// 개발 편의: 콘솔에서 window.game 으로 접근 (M1 한정, 디버깅용)
(window as unknown as { game: Phaser.Game }).game = game;
