/** Coordinates use Y-up. A platform's y is its walkable top surface. */
export interface Platform {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  thickness: number;
  radius?: number;
  kind?: 'island' | 'grass' | 'moving' | 'block';
}
export interface Point {
  x: number;
  y: number;
  z: number;
}

export const SPAWN: Point = { x: 0, y: 0, z: 5.7 };
export const SUMMIT: Point = { x: 0.3, y: 6.65, z: -7.4 };
export const COIN_TOTAL = 15;
export const PLATFORMS: readonly Platform[] = [
  {
    id: 'home',
    x: 0,
    y: 0,
    z: 0,
    width: 18.6,
    depth: 18.6,
    radius: 9.3,
    thickness: 3.8,
    kind: 'island',
  },
  {
    id: 'garden',
    x: -4.5,
    y: 1.15,
    z: -1.2,
    width: 4.2,
    depth: 4.2,
    thickness: 1.5,
    kind: 'grass',
  },
  { id: 'step', x: -0.9, y: 1.5, z: -2.3, width: 2.2, depth: 2.2, thickness: 1.8, kind: 'grass' },
  { id: 'middle', x: 1.5, y: 2.85, z: -4.2, width: 4, depth: 3.5, thickness: 3.15, kind: 'grass' },
  { id: 'upper', x: -1.9, y: 4.2, z: -6, width: 3.4, depth: 2.7, thickness: 4.5, kind: 'grass' },
  {
    id: 'summit',
    x: 0.3,
    y: 5.55,
    z: -7.4,
    width: 2.6,
    depth: 2.5,
    thickness: 5.85,
    kind: 'grass',
  },
  {
    id: 'little-island',
    x: 11,
    y: 1.4,
    z: -3.7,
    width: 3.2,
    depth: 3.2,
    radius: 1.6,
    thickness: 2.3,
    kind: 'island',
  },
  {
    id: 'ferry',
    x: 8.35,
    y: 0.65,
    z: -3.7,
    width: 1.9,
    depth: 1.9,
    thickness: 0.4,
    kind: 'moving',
  },
  { id: 'surprise', x: 2.5, y: 2.6, z: 1.4, width: 1, depth: 1, thickness: 1, kind: 'block' },
];
export const COINS: readonly Point[] = [
  { x: -1.9, y: 0.7, z: 4.8 },
  { x: -3.7, y: 0.7, z: 4 },
  { x: -5.5, y: 0.7, z: 2.5 },
  { x: -5.6, y: 1.85, z: -0.2 },
  { x: -3.7, y: 1.85, z: -2.2 },
  { x: -0.9, y: 2.2, z: -2.3 },
  { x: 1.1, y: 3.55, z: -3.5 },
  { x: 2.4, y: 3.55, z: -4.7 },
  { x: -1.5, y: 4.9, z: -5.8 },
  { x: 0.3, y: 6.25, z: -7.2 },
  { x: 4.7, y: 0.7, z: 3.6 },
  { x: 6.5, y: 0.7, z: 1.3 },
  { x: 7.1, y: 0.7, z: -2.8 },
  { x: 10.8, y: 2.1, z: -2.9 },
  { x: 2.5, y: 3.45, z: 1.4 },
];
export const FRAGMENTS: readonly Point[] = [
  { x: -5.3, y: 2.05, z: -1.7 },
  { x: 11.3, y: 2.3, z: -4.1 },
  { x: -2.4, y: 5.1, z: -6.1 },
];
export const BOUNCE: Point = { x: -5.9, y: 0.02, z: 1.5 };
export const ENEMIES = [
  { x: 3.8, y: 0, z: 2.3, axis: 'x' as const, distance: 1.3, speed: 0.8 },
  { x: -4.5, y: 1.15, z: -0.4, axis: 'x' as const, distance: 1.15, speed: 1 },
];

export function createPlatforms(): Platform[] {
  return PLATFORMS.map((p) => ({ ...p }));
}
export function animatePlatforms(platforms: Platform[], time: number): void {
  const ferry = platforms.find((p) => p.id === 'ferry');
  if (ferry) ferry.x = 8.45 + Math.sin(time * 0.8) * 0.65;
}
