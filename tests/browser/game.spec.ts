import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface Snapshot {
  mode: string;
  position: { x: number; y: number; z: number };
  grounded: boolean;
  coins: number;
  fragments: number;
  health: number;
  elapsed: number;
  defeated: number;
  drawCalls: number;
}
async function installClock(page: Page): Promise<void> {
  // Control elapsed game time so assertions also hold on software-rendered CI hosts.
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
}
async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() =>
    (window as unknown as { __POCKET_PEAK__: { snapshot(): Snapshot } }).__POCKET_PEAK__.snapshot(),
  );
}
async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
}
async function navigate(page: Page, x: number, z: number, jump = false): Promise<void> {
  let elapsed = 0;
  let lastJump = -1000;
  const held = new Set<string>();
  if (jump) {
    await page.keyboard.down('Space');
    lastJump = 0;
  }
  while (elapsed < 7000) {
    const state = await snapshot(page),
      dx = x - state.position.x,
      dz = z - state.position.z;
    if (state.mode === 'won' || (Math.hypot(dx, dz) < 0.4 && (!jump || state.grounded))) break;
    const ix = dx * Math.cos(0.55) - dz * Math.sin(0.55),
      iz = dx * Math.sin(0.55) + dz * Math.cos(0.55);
    const keys = new Set<string>();
    if (Math.abs(ix) > Math.max(0.15, Math.abs(iz) * 0.45)) keys.add(ix > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(iz) > Math.max(0.15, Math.abs(ix) * 0.45)) keys.add(iz > 0 ? 'KeyS' : 'KeyW');
    for (const key of held)
      if (!keys.has(key)) {
        await page.keyboard.up(key);
        held.delete(key);
      }
    for (const key of keys)
      if (!held.has(key)) {
        await page.keyboard.down(key);
        held.add(key);
      }
    if (jump && lastJump === 0 && elapsed > 290) {
      await page.keyboard.up('Space');
      await page.keyboard.down('Space');
      lastJump = elapsed;
    }
    if (jump && elapsed > 800) await page.keyboard.up('Space');
    // One rendered frame per control sample; the fixed-step controller still
    // integrates every physics step. This also keeps software-rendered CI fast.
    await page.clock.fastForward(50);
    elapsed += 50;
  }
  for (const key of held) await page.keyboard.up(key);
  await page.keyboard.up('Space');
  const state = await snapshot(page);
  expect(
    Math.hypot(x - state.position.x, z - state.position.z),
    `could not reach (${x}, ${z}), got ${JSON.stringify(state)}`,
  ).toBeLessThan(0.9);
}

test('renders, runs, jumps, rescues, pauses, and restarts without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installClock(page);
  await page.goto('/');
  await page.clock.runFor(32);
  await page.screenshot({ path: 'test-results/title-desktop.png' });
  await page.locator('#start').click();
  await page.clock.runFor(900);
  const before = await snapshot(page);
  expect(before.drawCalls).toBeGreaterThan(0);
  await page.keyboard.down('Space');
  await page.clock.runFor(180);
  expect((await snapshot(page)).position.y).toBeGreaterThan(0.7);
  await page.keyboard.up('Space');
  await page.keyboard.down('Space');
  await page.clock.runFor(120);
  expect((await snapshot(page)).position.y).toBeGreaterThan(1.8);
  await page.keyboard.up('Space');
  await page.clock.runFor(1100);
  await page.keyboard.press('KeyR');
  await page.clock.runFor(150);
  expect((await snapshot(page)).position.z).toBeCloseTo(5.7, 1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-screen')).toBeVisible();
  const pausedTime = (await snapshot(page)).elapsed;
  await page.clock.runFor(200);
  expect((await snapshot(page)).elapsed).toBe(pausedTime);
  await page.locator('#resume').click();
  await page.clock.runFor(250);
  expect((await snapshot(page)).elapsed).toBeGreaterThan(pausedTime);
  await page.screenshot({ path: 'test-results/game-desktop.png' });
  expect(errors).toEqual([]);
});

test('can collect all three fragments and win using normal controls', async ({ page }) => {
  test.setTimeout(180_000);
  await installClock(page);
  await start(page);
  await page.clock.runFor(700);
  await navigate(page, -1.9, 4.8);
  await navigate(page, -3.7, 4);
  await navigate(page, -5.5, 2.5);
  await navigate(page, -5.3, -1.7, true);
  expect((await snapshot(page)).fragments).toBe(1);
  // Return to the open lawn and cross to the little sky garden.
  await navigate(page, -3.5, 1.5);
  await navigate(page, 5.7, 0.2);
  await navigate(page, 7.2, -2.8);
  await navigate(page, 11.1, -3.8, true);
  expect((await snapshot(page)).fragments).toBe(2);
  await navigate(page, 7.1, -2.8, true);
  await navigate(page, 4, -0.7);
  await navigate(page, -0.9, 0.2);
  await navigate(page, -0.9, -2.3, true);
  await navigate(page, 1.5, -4.2, true);
  await navigate(page, -2.4, -6.1, true);
  expect((await snapshot(page)).fragments).toBe(3);
  await navigate(page, 0.3, -7.4, true);
  await expect(page.locator('#win-screen')).toBeVisible();
  await page.screenshot({ path: 'test-results/win-desktop.png' });
  await page.locator('#explore').click();
  expect((await snapshot(page)).mode).toBe('exploring');
  await page.keyboard.press('Escape');
  await page.locator('#restart').click();
  const reset = await snapshot(page);
  expect(reset.fragments).toBe(0);
  expect(reset.coins).toBe(0);
  expect(reset.health).toBe(3);
});

test('touch controls work on a phone-sized screen', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    baseURL,
  });
  const page = await context.newPage();
  await installClock(page);
  await page.goto('/');
  await page.clock.runFor(32);
  await page.screenshot({ path: 'test-results/title-mobile.png' });
  await page.locator('#start').tap();
  await page.clock.runFor(600);
  await expect(page.locator('#touch-jump')).toBeVisible();
  await page.locator('#touch-jump').tap();
  await page.clock.runFor(160);
  expect((await snapshot(page)).position.y).toBeGreaterThan(0.3);
  await page.screenshot({ path: 'test-results/game-mobile.png' });
  await context.close();
});
