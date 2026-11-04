const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export class UI {
  private toastTimer = 0;
  private lastCoins = -1;
  private lastFragments = -1;
  private lastHealth = -1;
  private lastSecond = -1;
  start(): void {
    document.body.classList.add('starting', 'playing');
    for (const id of ['intro', 'intro-footer', 'world-label']) element(id).hidden = true;
    element('hud').hidden = false;
    element('pause').hidden = false;
    element('pause-screen').hidden = true;
    element('win-screen').hidden = true;
    this.lastCoins = this.lastFragments = this.lastHealth = this.lastSecond = -1;
  }
  update(coins: number, fragments: ReadonlySet<number>, health: number, elapsed: number): void {
    if (coins !== this.lastCoins) {
      element('coins').textContent = String(coins);
      this.lastCoins = coins;
    }
    if (fragments.size !== this.lastFragments) {
      [...element('fragment-icons').children].forEach((node, i) =>
        node.classList.toggle('found', fragments.has(i)),
      );
      element('objective').textContent =
        fragments.size === 3 ? 'Claim the summit star!' : 'Find the 3 star fragments';
      element('mission-hint').textContent =
        fragments.size === 3
          ? 'The star is waiting at the very top.'
          : 'Follow the gold coins. Go a little higher.';
      this.lastFragments = fragments.size;
    }
    if (health !== this.lastHealth) {
      element('hearts').textContent = '♥ '.repeat(health) + '♡ '.repeat(3 - health);
      element('hearts').setAttribute('aria-label', `${health} hearts`);
      this.lastHealth = health;
    }
    if (Math.floor(elapsed) !== this.lastSecond) {
      element('timer').textContent = formatTime(elapsed);
      this.lastSecond = Math.floor(elapsed);
    }
  }
  toast(message: string): void {
    window.clearTimeout(this.toastTimer);
    const toast = element('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 4000);
  }
  pause(paused: boolean): void {
    element('pause-screen').hidden = !paused;
    if (paused) element<HTMLButtonElement>('resume').focus();
  }
  sound(muted: boolean): void {
    element('sound').classList.toggle('sound-on', !muted);
    element('sound').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }
  win(coins: number, elapsed: number): void {
    element('win-coins').textContent = `${coins} / 15`;
    element('win-time').textContent = formatTime(elapsed);
    let best: number | null = null;
    try {
      const stored = Number(localStorage.getItem('pocket-peak-best'));
      best = stored > 0 ? stored : null;
      if (!best || elapsed < best) {
        localStorage.setItem('pocket-peak-best', String(elapsed));
        element('best-time').textContent = 'A new personal best. Nice little adventure!';
      } else element('best-time').textContent = `Personal best · ${formatTime(best)}`;
    } catch {
      element('best-time').textContent = '';
    }
    element('win-screen').hidden = false;
    element<HTMLButtonElement>('play-again').focus();
  }
  closeWin(): void {
    element('win-screen').hidden = true;
  }
  error(message?: string): void {
    element('error-screen').hidden = false;
    if (message) element('error-message').textContent = message;
  }
}
export function onClick(id: string, handler: () => void): void {
  element(id).addEventListener('click', handler);
}
