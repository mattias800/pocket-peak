import * as THREE from 'three';
import { AudioEngine } from './audio';
import { Input } from './input';
import {
  animatePlatforms,
  BOUNCE,
  COINS,
  COIN_TOTAL,
  createPlatforms,
  ENEMIES,
  FRAGMENTS,
  SPAWN,
  SUMMIT,
} from './level';
import type { Point } from './level';
import { BODY, createBody, floorAt, stepPlayer } from './physics';
import { UI, onClick } from './ui';
import { animateHero, createWorld } from './visuals';

type Mode = 'intro' | 'playing' | 'paused' | 'won' | 'exploring';
interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}
const STEP = 1 / 120;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const damp = (a: number, b: number, rate: number, dt: number) =>
  THREE.MathUtils.lerp(a, b, 1 - Math.exp(-rate * dt));

export class Game {
  readonly platforms = createPlatforms();
  readonly player = createBody(SPAWN);
  readonly visuals;
  readonly input;
  readonly audio = new AudioEngine();
  readonly ui = new UI();
  mode: Mode = 'intro';
  readonly coins = new Set<number>();
  readonly fragments = new Set<number>();
  readonly defeated = new Set<number>();
  health = 3;
  elapsed = 0;
  private worldTime = 0;
  private previousFrame = 0;
  private accumulator = 0;
  private invincible = 0;
  private bounceCooldown = 0;
  private checkpoint: Point = { ...SPAWN };
  private yaw = 0.55;
  private zoom = 21;
  private facing = 0;
  private cameraTarget = new THREE.Vector3(-5.5, 1.7, 3.4);
  private cameraPosition = new THREE.Vector3();
  private particles: Particle[] = [];
  private particleMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private questionUsed = false;
  private dustTimer = 0;
  private landingSquash = 0;
  private startTransition = 0;
  private lastFerryX = 8.45;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(canvas: HTMLCanvasElement) {
    this.visuals = createWorld(canvas, this.platforms);
    this.input = new Input(canvas);
    this.ui.sound(this.audio.muted);
    this.visuals.hero.group.position.set(SPAWN.x, SPAWN.y, SPAWN.z);
    this.input.onPause = () => this.togglePause();
    this.input.onRescue = () => {
      if (this.isActive) this.respawn(false);
    };
    this.input.onMute = () => this.ui.sound(this.audio.toggle());
    this.input.onConfirm = () => {
      if (this.mode === 'intro') this.start();
    };
    onClick('start', () => this.start());
    onClick('restart', () => this.start());
    onClick('play-again', () => this.start());
    onClick('pause', () => this.togglePause());
    onClick('resume', () => this.togglePause());
    onClick('sound', () => this.ui.sound(this.audio.toggle()));
    onClick('explore', () => {
      this.mode = 'exploring';
      this.ui.closeWin();
      this.ui.toast('Stay curious. There may be a few coins left.');
    });
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isActive) this.togglePause();
      this.previousFrame = 0;
    });
    window.addEventListener('blur', () => {
      if (this.isActive) this.togglePause();
    });
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.mode = 'paused';
      this.ui.error(
        'The graphics connection took a break. Reload the page to start a fresh adventure.',
      );
    });
    this.resize();
    this.updateCamera(1);
    this.visuals.renderer.setAnimationLoop((time) => this.frame(time));
  }
  get isActive(): boolean {
    return this.mode === 'playing' || this.mode === 'exploring';
  }

  start(): void {
    this.audio.unlock();
    this.mode = 'playing';
    this.coins.clear();
    this.fragments.clear();
    this.defeated.clear();
    this.health = 3;
    this.elapsed = 0;
    this.invincible = 0;
    this.questionUsed = false;
    this.checkpoint = { ...SPAWN };
    this.yaw = 0.55;
    this.zoom = 21;
    this.startTransition = 1;
    this.worldTime = 0;
    Object.assign(this.player, createBody(SPAWN));
    this.input.clear();
    this.visuals.coins.forEach((coin) => {
      coin.visible = true;
    });
    this.visuals.fragments.forEach((fragment) => {
      fragment.visible = true;
    });
    this.visuals.enemies.forEach((enemy) => {
      enemy.visible = true;
      enemy.scale.setScalar(1);
    });
    this.visuals.star.visible = false;
    for (const particle of this.particles) this.visuals.scene.remove(particle.mesh);
    this.particles = [];
    this.ui.start();
    this.ui.update(0, this.fragments, this.health, 0);
    this.ui.toast('Hello, Pip! Hold jump to go higher. Tap again for a double jump.');
    (document.activeElement as HTMLElement | null)?.blur();
  }
  togglePause(): void {
    if (this.mode === 'intro' || this.mode === 'won') return;
    if (this.mode === 'paused') {
      this.mode = this.fragments.size === 3 && !this.visuals.star.visible ? 'exploring' : 'playing';
      this.ui.pause(false);
    } else {
      this.mode = 'paused';
      this.ui.pause(true);
    }
    this.input.clear();
    this.accumulator = 0;
  }
  private resize(): void {
    const { renderer, camera } = this.visuals;
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  private frame(timestamp: number): void {
    const dt = this.previousFrame ? Math.min((timestamp - this.previousFrame) / 1000, 0.06) : 0;
    this.previousFrame = timestamp;
    this.input.pollGamepad();
    if (this.isActive || this.mode === 'intro') this.worldTime += dt;
    if (this.isActive) {
      if (this.mode === 'playing') this.elapsed += dt;
      this.accumulator = Math.min(this.accumulator + dt, 0.1);
      while (this.accumulator >= STEP && this.isActive) {
        this.update(STEP);
        this.accumulator -= STEP;
      }
      this.ui.update(this.coins.size, this.fragments, this.health, this.elapsed);
    } else this.accumulator = 0;
    this.animate(dt);
    this.updateCamera(dt);
    this.audio.update(this.isActive);
    this.visuals.renderer.render(this.visuals.scene, this.visuals.camera);
  }
  private update(dt: number): void {
    this.invincible = Math.max(0, this.invincible - dt);
    this.bounceCooldown = Math.max(0, this.bounceCooldown - dt);
    this.yaw += this.input.orbit;
    this.input.orbit = 0;
    if (this.input.keys.has('KeyQ')) this.yaw += dt * 1.5;
    if (this.input.keys.has('KeyE')) this.yaw -= dt * 1.5;
    this.zoom = THREE.MathUtils.clamp(this.zoom + this.input.zoom, 14, 32);
    this.input.zoom = 0;
    const ferry = this.platforms.find((platform) => platform.id === 'ferry')!;
    this.lastFerryX = ferry.x;
    animatePlatforms(this.platforms, this.worldTime);
    if (this.player.platformId === 'ferry') this.player.position.x += ferry.x - this.lastFerryX;
    for (const platform of this.platforms)
      this.visuals.platforms.get(platform.id)!.position.set(platform.x, platform.y, platform.z);
    const previousY = this.player.position.y;
    const controls = this.input.sample(this.yaw);
    const events = stepPlayer(this.player, controls, this.platforms, dt);
    if (events.jumped) {
      this.audio.effect(events.doubleJumped ? 'double' : 'jump');
      this.burst(
        this.player.position,
        events.doubleJumped ? '#fff5d6' : '#d7d7a1',
        events.doubleJumped ? 12 : 7,
      );
      this.landingSquash = -0.13;
    }
    if (events.landed) {
      this.landingSquash = 0.18;
      if (this.player.position.y > 0.5) this.burst(this.player.position, '#e3dfa8', 7);
    }
    if (events.bumped === 'surprise' && !this.questionUsed) {
      this.questionUsed = true;
      this.audio.effect('coin');
      this.collectCoin(14);
      this.ui.toast('A little surprise! Jump on top to reach it, too.');
    }
    const p = this.player.position;
    const center = { x: p.x, y: p.y + 0.65, z: p.z };
    this.visuals.coins.forEach((coin, i) => {
      if (!this.coins.has(i) && distance(center, coin.position) < 0.78) this.collectCoin(i);
    });
    this.visuals.fragments.forEach((fragment, i) => {
      if (!this.fragments.has(i) && distance(center, fragment.position) < 0.95) {
        this.fragments.add(i);
        fragment.visible = false;
        this.audio.effect('fragment');
        this.burst(fragment.position, '#ffda6c', 24);
        if (i === 2) {
          this.checkpoint = { x: -1.9, y: 4.2, z: -5.7 };
          this.ui.toast('Summit checkpoint! The top is just one more hop.');
        } else
          this.ui.toast(
            i === 0
              ? 'Garden fragment! Two more little adventures await.'
              : 'Sky-garden fragment! What a lovely little detour.',
          );
        if (this.fragments.size === 3) {
          this.visuals.star.visible = true;
          this.ui.toast('The summit star is awake! Get to the very top.');
          this.burst(SUMMIT, '#fff0b5', 35);
        }
      }
    });
    if (
      this.player.grounded &&
      this.bounceCooldown === 0 &&
      Math.hypot(p.x - BOUNCE.x, p.z - BOUNCE.z) < 0.8 &&
      p.y < 0.3
    ) {
      this.player.velocity.y = 15;
      this.player.grounded = false;
      this.player.jumps = 1;
      this.player.coyote = 0;
      this.bounceCooldown = 0.7;
      this.audio.effect('bounce');
      this.burst(BOUNCE, '#fce7b5', 14);
    }
    this.visuals.enemies.forEach((enemy, i) => {
      if (this.defeated.has(i)) return;
      const config = ENEMIES[i];
      enemy.position[config.axis] =
        config[config.axis] + Math.sin(this.worldTime * config.speed) * config.distance;
      enemy.rotation.y =
        config.axis === 'x'
          ? Math.cos(this.worldTime * config.speed) > 0
            ? Math.PI / 2
            : -Math.PI / 2
          : 0;
      if (
        Math.hypot(p.x - enemy.position.x, p.z - enemy.position.z) > 0.68 ||
        p.y > enemy.position.y + 0.85 ||
        p.y + BODY.height < enemy.position.y
      )
        return;
      if (this.player.velocity.y < -1 && previousY > enemy.position.y + 0.52) {
        this.defeated.add(i);
        enemy.visible = false;
        this.player.velocity.y = 9.5;
        this.player.jumps = 1;
        this.audio.effect('stomp');
        this.burst({ ...enemy.position, y: enemy.position.y + 0.3 }, '#e9b779', 16);
        this.ui.toast('Boop! A perfectly good grumbling stomp.');
      } else if (this.invincible <= 0) {
        this.health--;
        this.invincible = 2;
        this.audio.effect('hurt');
        const dx = p.x - enemy.position.x,
          dz = p.z - enemy.position.z,
          length = Math.max(0.1, Math.hypot(dx, dz));
        this.player.velocity.x = (dx / length) * 9;
        this.player.velocity.z = (dz / length) * 9;
        this.player.velocity.y = 7;
        this.player.grounded = false;
        this.player.coyote = 0;
        this.ui.toast('Oop! Jump on their heads to give them a boop.');
        if (this.health <= 0) this.respawn(true);
      }
    });
    if (p.y < -10) this.respawn(true);
    if (
      this.visuals.star.visible &&
      this.fragments.size === 3 &&
      distance(center, this.visuals.star.position) < 1.05
    ) {
      this.mode = 'won';
      this.visuals.star.visible = false;
      this.audio.effect('win');
      this.burst(SUMMIT, '#ffdc73', 65);
      this.ui.win(this.coins.size, this.elapsed);
      this.input.clear();
    }
    const speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    this.dustTimer -= dt;
    if (this.player.grounded && speed > 3 && this.dustTimer <= 0) {
      this.burst(p, '#e3dfa8', 1, 0.45);
      this.dustTimer = 0.12;
    }
  }
  private collectCoin(index: number): void {
    if (this.coins.has(index)) return;
    this.coins.add(index);
    this.visuals.coins[index].visible = false;
    this.audio.effect('coin');
    this.burst(COINS[index], '#ffe08c', 8);
    if (this.coins.size === COIN_TOTAL) {
      this.health = 3;
      this.ui.toast('Every last coin! A perfect little collection. Hearts refilled.');
    }
  }
  private respawn(hurt: boolean): void {
    if (hurt) {
      this.health = this.health <= 1 ? 3 : this.health - 1;
      this.audio.effect('hurt');
    }
    Object.assign(this.player, createBody(this.checkpoint));
    this.player.platformId = this.checkpoint.y > 0 ? 'upper' : 'home';
    this.invincible = 1.5;
    this.burst(this.checkpoint, '#fff1c7', 20);
    this.ui.toast(
      hurt
        ? 'A little tumble. Your coins and fragments are safe!'
        : 'Back on solid ground. Deep breath, little explorer.',
    );
  }
  private burst(point: Point, color: string, count: number, force = 1): void {
    if (this.reducedMotion && count > 10) count = 6;
    if (!this.particleMaterials.has(color))
      this.particleMaterials.set(color, new THREE.MeshBasicMaterial({ color }));
    for (let i = 0; i < count && this.particles.length < 180; i++) {
      const mesh = new THREE.Mesh(this.visuals.dustGeometry, this.particleMaterials.get(color)!);
      mesh.position.set(point.x, point.y + 0.12, point.z);
      mesh.scale.setScalar(0.6 + Math.random() * 1.3);
      this.visuals.scene.add(mesh);
      const life = 0.45 + Math.random() * 0.55;
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5 * force,
          (1 + Math.random() * 4) * force,
          (Math.random() - 0.5) * 5 * force,
        ),
        life,
        maxLife: life,
      });
    }
  }
  private animate(dt: number): void {
    const t = this.worldTime,
      { hero } = this.visuals,
      p = this.player.position,
      v = this.player.velocity;
    hero.group.position.set(p.x, p.y, p.z);
    const speed = Math.hypot(v.x, v.z);
    if (speed > 0.2) this.facing = Math.atan2(v.x, v.z);
    let difference = this.facing - hero.group.rotation.y;
    difference = Math.atan2(Math.sin(difference), Math.cos(difference));
    hero.group.rotation.y += difference * Math.min(1, dt * 16);
    this.landingSquash = damp(this.landingSquash, 0, 14, dt);
    hero.model.scale.set(
      1 + this.landingSquash * 0.5,
      1 - this.landingSquash,
      1 + this.landingSquash * 0.5,
    );
    animateHero(hero, speed, t, this.player.grounded, v.y);
    hero.model.visible = this.invincible <= 0 || Math.sin(t * 35) > -0.3;
    const floor = floorAt(this.platforms, p.x, p.z, p.y + 0.2);
    hero.shadow.visible = floor !== null;
    if (floor !== null) {
      hero.shadow.position.set(p.x, floor + 0.055, p.z);
      hero.shadow.scale.setScalar(1 + (p.y - floor) * 0.1);
      (hero.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0.05,
        0.23 - (p.y - floor) * 0.025,
      );
    }
    this.visuals.coins.forEach((coin, i) => {
      coin.rotation.y = t * 1.8 + i;
      coin.position.y = COINS[i].y + Math.sin(t * 2.4 + i) * 0.08;
    });
    this.visuals.fragments.forEach((fragment, i) => {
      fragment.rotation.y = t + i;
      fragment.position.y = FRAGMENTS[i].y + Math.sin(t * 2 + i) * 0.13;
    });
    this.visuals.star.rotation.y = Math.sin(t * 0.8) * 0.45 + this.yaw;
    this.visuals.star.position.y = SUMMIT.y + Math.sin(t * 2) * 0.16;
    this.visuals.bounce.scale.y =
      this.bounceCooldown > 0.4
        ? 0.55 + (0.7 - this.bounceCooldown) * 1.5
        : 1 + Math.sin(t * 3) * 0.035;
    this.visuals.clouds.forEach((cloud, i) => {
      cloud.position.x += Math.sin(i * 13) * dt * 0.06;
      cloud.position.y += Math.sin(t * 0.4 + i) * dt * 0.03;
    });
    if (this.mode !== 'paused') {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const particle = this.particles[i];
        particle.life -= dt;
        if (particle.life <= 0) {
          this.visuals.scene.remove(particle.mesh);
          this.particles.splice(i, 1);
          continue;
        }
        particle.velocity.y -= dt * 8;
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.mesh.rotation.x += dt * 3;
        particle.mesh.scale.setScalar(Math.max(0, particle.life / particle.maxLife));
      }
    }
  }
  private updateCamera(dt: number): void {
    const mobile = innerWidth < 650,
      aspect = innerWidth / innerHeight;
    const intro = this.mode === 'intro';
    let target: THREE.Vector3, position: THREE.Vector3;
    if (intro) {
      const yaw = 0.58;
      const offset = mobile ? 0 : -5.6;
      target = new THREE.Vector3(
        Math.cos(yaw) * offset + 1.3,
        mobile ? -6 : 1.2,
        -Math.sin(yaw) * offset - 0.8,
      );
      const radius = mobile ? 48 : aspect < 1.5 ? 36 : 32;
      position = target
        .clone()
        .add(new THREE.Vector3(Math.sin(yaw) * radius, radius * 0.69, Math.cos(yaw) * radius));
    } else {
      const p = this.player.position;
      target = new THREE.Vector3(p.x * 0.68 + 0.5, Math.max(0, p.y) * 0.6 + 1, p.z * 0.68 - 1.3);
      const radius = this.zoom * (mobile ? 1.22 : 1);
      position = target
        .clone()
        .add(
          new THREE.Vector3(
            Math.sin(this.yaw) * radius,
            radius * 0.73,
            Math.cos(this.yaw) * radius,
          ),
        );
    }
    const blend =
      this.reducedMotion || dt >= 1 ? 1 : 1 - Math.exp(-(this.startTransition > 0 ? 2.6 : 5) * dt);
    this.cameraTarget.lerp(target, blend);
    this.cameraPosition.lerp(position, blend);
    this.startTransition = Math.max(0, this.startTransition - dt);
    this.visuals.camera.position.copy(this.cameraPosition);
    this.visuals.camera.lookAt(this.cameraTarget);
  }

  /** Read-only diagnostics for smoke tests and future devtools. No gameplay shortcuts. */
  snapshot() {
    return {
      mode: this.mode,
      position: { ...this.player.position },
      velocity: { ...this.player.velocity },
      grounded: this.player.grounded,
      coins: this.coins.size,
      fragments: this.fragments.size,
      health: this.health,
      elapsed: this.elapsed,
      defeated: this.defeated.size,
      drawCalls: this.visuals.renderer.info.render.calls,
    };
  }
}
