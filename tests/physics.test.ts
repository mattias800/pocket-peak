import { describe, expect, it } from 'vitest';
import { createBody, MOTION, stepPlayer } from '../src/physics';
import type { MoveInput } from '../src/physics';
import { createPlatforms, SPAWN } from '../src/level';
import type { Platform } from '../src/level';

const idle: MoveInput = { x: 0, z: 0, jumpPressed: false, jumpHeld: false, run: false };
const floor: Platform[] = [{ id: 'home', x: 0, y: 0, z: 0, width: 100, depth: 100, thickness: 4 }];
const tick = (
  body: ReturnType<typeof createBody>,
  input: Partial<MoveInput> = {},
  n = 1,
  platforms = floor,
) => {
  for (let i = 0; i < n; i++)
    stepPlayer(
      body,
      { ...idle, ...input, jumpPressed: i === 0 && !!input.jumpPressed },
      platforms,
      1 / 120,
    );
};

describe('player movement', () => {
  it('rests on the surface without sinking or drifting', () => {
    const body = createBody(SPAWN);
    tick(body, {}, 1200);
    expect(body.position).toEqual(SPAWN);
    expect(body.grounded).toBe(true);
  });
  it('normalizes diagonals and reaches the same speed as cardinal movement', () => {
    const straight = createBody(SPAWN),
      diagonal = createBody(SPAWN);
    tick(straight, { x: 1 }, 120);
    tick(diagonal, { x: 1, z: 1 }, 120);
    expect(Math.hypot(diagonal.velocity.x, diagonal.velocity.z)).toBeCloseTo(MOTION.walk, 3);
    expect(Math.hypot(straight.velocity.x, straight.velocity.z)).toBeCloseTo(
      Math.hypot(diagonal.velocity.x, diagonal.velocity.z),
      6,
    );
  });
  it('supports variable jump height, a second jump, and no third jump', () => {
    const short = createBody(SPAWN),
      held = createBody(SPAWN);
    tick(short, { jumpPressed: true });
    tick(held, { jumpPressed: true, jumpHeld: true });
    tick(short, {}, 24);
    tick(held, { jumpHeld: true }, 24);
    expect(held.position.y).toBeGreaterThan(short.position.y + 0.4);
    tick(held, { jumpPressed: true, jumpHeld: true });
    expect(held.jumps).toBe(2);
    tick(held, { jumpHeld: true }, 5);
    const velocity = held.velocity.y;
    tick(held, { jumpPressed: true, jumpHeld: true });
    expect(held.velocity.y).toBeLessThan(velocity);
    tick(held, {}, 180);
    expect(held.position.y).toBe(0);
    expect(held.jumps).toBe(0);
  });
  it('allows a coyote jump shortly after leaving a ledge', () => {
    const body = createBody({ x: 0, y: 2, z: 0 });
    body.grounded = false;
    body.coyote = 0.09;
    tick(body, { jumpPressed: true, jumpHeld: true });
    expect(body.jumps).toBe(1);
    expect(body.velocity.y).toBeGreaterThan(10);
  });
  it('lands on a raised platform and blocks its side below the top', () => {
    const ledge: Platform = { id: 'ledge', x: 2, y: 1.5, z: 0, width: 2, depth: 3, thickness: 1.5 };
    const body = createBody({ x: 0, y: 0, z: 0 });
    tick(body, { x: 1 }, 120, [...floor, ledge]);
    expect(body.position.x).toBeLessThan(0.7);
    body.position.x = 2;
    body.position.y = 3;
    body.velocity.y = -2;
    body.grounded = false;
    tick(body, {}, 60, [...floor, ledge]);
    expect(body.position.y).toBe(1.5);
    expect(body.platformId).toBe('ledge');
  });
  it('reports a question block hit from below', () => {
    const platforms = createPlatforms(),
      block = platforms.find((p) => p.id === 'surprise')!;
    const body = createBody({ x: block.x, y: 0, z: block.z });
    let bumped = false;
    for (let i = 0; i < 60; i++) {
      const event = stepPlayer(
        body,
        { ...idle, jumpPressed: i === 0, jumpHeld: true },
        platforms,
        1 / 120,
      );
      if (event.bumped === 'surprise') bumped = true;
    }
    expect(bumped).toBe(true);
    expect(body.position.y).toBe(0);
  });
  it('can jump all the way up the authored staircase', () => {
    // Simulate the same controls as gameplay, including landing between hops.
    const platforms = createPlatforms();
    const body = createBody({ x: -0.9, y: 0, z: 0.3 });
    const route = [
      { x: -0.9, y: 1.5, z: -2.3 },
      { x: 1.5, y: 2.85, z: -4.2 },
      { x: -1.9, y: 4.2, z: -6 },
      { x: 0.3, y: 5.55, z: -7.4 },
    ];
    for (const target of route) {
      let arrived = false;
      for (let i = 0; i < 360; i++) {
        const dx = target.x - body.position.x,
          dz = target.z - body.position.z,
          length = Math.hypot(dx, dz);
        stepPlayer(
          body,
          {
            x: length > 0.12 ? dx / Math.max(1, length) : 0,
            z: length > 0.12 ? dz / Math.max(1, length) : 0,
            jumpPressed: i === 0 || i === 38,
            jumpHeld: i < 80,
            run: false,
          },
          platforms,
          1 / 120,
        );
        if (body.grounded && Math.abs(body.position.y - target.y) < 0.01 && length < 0.5) {
          arrived = true;
          break;
        }
      }
      expect(
        arrived,
        `unreachable platform at ${JSON.stringify(target)}; player ${JSON.stringify(body.position)}`,
      ).toBe(true);
    }
  });
});
