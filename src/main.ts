import './style.css';
import { Game } from './game';
import { UI } from './ui';

try {
  const game = new Game(document.querySelector<HTMLCanvasElement>('#game')!);
  // A read-only hook makes real browser smoke tests independent of rendering internals.
  Object.defineProperty(window, '__POCKET_PEAK__', {
    value: Object.freeze({ snapshot: () => game.snapshot() }),
    writable: false,
  });
} catch (error) {
  console.error('Pocket Peak could not start:', error);
  new UI().error();
}
