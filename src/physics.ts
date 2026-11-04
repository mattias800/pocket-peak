import type { Platform, Point } from './level';

export const BODY = { radius: 0.32, height: 1.2 };
export const MOTION = {
  gravity: 25,
  jump: 10.8,
  doubleJump: 10.2,
  walk: 5.2,
  run: 7.4,
  coyote: 0.12,
  buffer: 0.14,
};
export interface PlayerBody {
  position: Point;
  velocity: Point;
  grounded: boolean;
  platformId: string | null;
  coyote: number;
  jumpBuffer: number;
  jumps: number;
}
export interface MoveInput {
  x: number;
  z: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  run: boolean;
}
export interface PhysicsEvents {
  jumped: boolean;
  doubleJumped: boolean;
  landed: boolean;
  bumped: string | null;
}

export function createBody(spawn: Point): PlayerBody {
  return {
    position: { ...spawn },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: true,
    platformId: 'home',
    coyote: MOTION.coyote,
    jumpBuffer: 0,
    jumps: 0,
  };
}
export function contains(platform: Platform, x: number, z: number, margin = 0): boolean {
  if (platform.radius)
    return Math.hypot(x - platform.x, z - platform.z) <= platform.radius + margin;
  return (
    Math.abs(x - platform.x) <= platform.width / 2 + margin &&
    Math.abs(z - platform.z) <= platform.depth / 2 + margin
  );
}
export function floorAt(
  platforms: readonly Platform[],
  x: number,
  z: number,
  ceiling = Infinity,
): number | null {
  let floor: number | null = null;
  for (const p of platforms)
    if (p.y <= ceiling && contains(p, x, z) && (floor === null || p.y > floor)) floor = p.y;
  return floor;
}

/** Fixed-step kinematic controller. No render state or wall-clock dependencies. */
export function stepPlayer(
  body: PlayerBody,
  input: MoveInput,
  platforms: readonly Platform[],
  dt: number,
): PhysicsEvents {
  const events: PhysicsEvents = { jumped: false, doubleJumped: false, landed: false, bumped: null };
  const p = body.position,
    v = body.velocity;
  body.coyote = body.grounded ? MOTION.coyote : Math.max(0, body.coyote - dt);
  body.jumpBuffer = input.jumpPressed ? MOTION.buffer : Math.max(0, body.jumpBuffer - dt);
  if (body.jumpBuffer > 0 && (body.coyote > 0 || body.jumps < 2)) {
    const first = body.coyote > 0;
    v.y = first ? MOTION.jump : MOTION.doubleJump;
    body.jumps = first ? 1 : 2;
    body.grounded = false;
    body.platformId = null;
    body.coyote = 0;
    body.jumpBuffer = 0;
    events.jumped = true;
    events.doubleJumped = !first;
  }
  const length = Math.hypot(input.x, input.z);
  const speed = input.run ? MOTION.run : MOTION.walk;
  const tx = length > 0 ? (input.x / Math.max(1, length)) * speed : 0;
  const tz = length > 0 ? (input.z / Math.max(1, length)) * speed : 0;
  const response = 1 - Math.exp(-(body.grounded ? 17 : 8) * dt);
  v.x += (tx - v.x) * response;
  v.z += (tz - v.z) * response;
  p.x += v.x * dt;
  p.z += v.z * dt;

  // Resolve horizontal overlaps only when the body actually spans a side face.
  for (const platform of platforms) {
    if (p.y >= platform.y - 0.06 || p.y + BODY.height <= platform.y - platform.thickness + 0.03)
      continue;
    if (platform.radius) {
      const dx = p.x - platform.x,
        dz = p.z - platform.z,
        distance = Math.hypot(dx, dz);
      if (distance < platform.radius + BODY.radius && distance > 0.001) {
        const push = platform.radius + BODY.radius - distance;
        p.x += (dx / distance) * push;
        p.z += (dz / distance) * push;
      }
    } else {
      const nx = Math.max(
        platform.x - platform.width / 2,
        Math.min(p.x, platform.x + platform.width / 2),
      );
      const nz = Math.max(
        platform.z - platform.depth / 2,
        Math.min(p.z, platform.z + platform.depth / 2),
      );
      const dx = p.x - nx,
        dz = p.z - nz,
        distance = Math.hypot(dx, dz);
      if (distance > 0.0001 && distance < BODY.radius) {
        p.x += (dx / distance) * (BODY.radius - distance);
        p.z += (dz / distance) * (BODY.radius - distance);
      } else if (distance <= 0.0001) {
        const ox = platform.width / 2 + BODY.radius - Math.abs(p.x - platform.x);
        const oz = platform.depth / 2 + BODY.radius - Math.abs(p.z - platform.z);
        if (ox < oz) p.x += (p.x >= platform.x ? 1 : -1) * ox;
        else p.z += (p.z >= platform.z ? 1 : -1) * oz;
      }
    }
  }

  const previousY = p.y;
  v.y -= MOTION.gravity * (v.y > 0 && !input.jumpHeld ? 2.05 : 1) * dt;
  p.y += v.y * dt;
  const wasGrounded = body.grounded;
  body.grounded = false;
  body.platformId = null;
  for (const platform of platforms) {
    if (!contains(platform, p.x, p.z, BODY.radius * 0.35)) continue;
    if (
      v.y <= 0 &&
      previousY >= platform.y - 0.07 &&
      p.y <= platform.y &&
      (!body.grounded || platform.y > p.y)
    ) {
      p.y = platform.y;
      v.y = 0;
      body.grounded = true;
      body.platformId = platform.id;
      body.jumps = 0;
    } else {
      const bottom = platform.y - platform.thickness;
      if (v.y > 0 && previousY + BODY.height <= bottom + 0.03 && p.y + BODY.height >= bottom) {
        p.y = bottom - BODY.height;
        v.y = 0;
        events.bumped = platform.id;
      }
    }
  }
  events.landed = body.grounded && !wasGrounded;
  return events;
}
