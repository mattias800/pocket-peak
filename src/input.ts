export class Input {
  readonly keys = new Set<string>();
  private jumpQueued = false;
  private touchJump = false;
  private previousGamepadJump = false;
  private previousGamepadPause = false;
  private padJump = false;
  private padX = 0;
  private padY = 0;
  private padRun = false;
  private touchX = 0;
  private touchY = 0;
  onPause = () => {};
  onRescue = () => {};
  onMute = () => {};
  onConfirm = () => {};
  orbit = 0;
  zoom = 0;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code))
        event.preventDefault();
      if (event.repeat) return;
      this.keys.add(event.code);
      if (event.code === 'Space') this.jumpQueued = true;
      if (event.code === 'Escape') this.onPause();
      if (event.code === 'KeyR') this.onRescue();
      if (event.code === 'KeyM') this.onMute();
      if (event.code === 'Enter') this.onConfirm();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (event.buttons === 1 && event.pointerType !== 'touch')
        this.orbit -= event.movementX * 0.006;
    });
    canvas.addEventListener(
      'wheel',
      (event) => {
        this.zoom += event.deltaY * 0.008;
      },
      { passive: true },
    );
    const joystick = document.querySelector<HTMLDivElement>('#joystick')!;
    const stick = document.querySelector<HTMLDivElement>('#stick')!;
    let stickPointer: number | null = null;
    const moveStick = (event: PointerEvent) => {
      const rect = joystick.getBoundingClientRect();
      let x = (event.clientX - rect.left - rect.width / 2) / 38;
      let y = (event.clientY - rect.top - rect.height / 2) / 38;
      const length = Math.max(1, Math.hypot(x, y));
      x /= length;
      y /= length;
      this.touchX = x;
      this.touchY = y;
      stick.style.transform = `translate(${x * 28}px,${y * 28}px)`;
    };
    joystick.addEventListener('pointerdown', (event) => {
      stickPointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      moveStick(event);
    });
    joystick.addEventListener('pointermove', (event) => {
      if (stickPointer === event.pointerId) moveStick(event);
    });
    const release = () => {
      stickPointer = null;
      this.touchX = this.touchY = 0;
      stick.style.transform = '';
    };
    joystick.addEventListener('pointerup', release);
    joystick.addEventListener('pointercancel', release);
    joystick.addEventListener('lostpointercapture', release);
    const jumpButton = document.querySelector<HTMLButtonElement>('#touch-jump')!;
    jumpButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      jumpButton.setPointerCapture(event.pointerId);
      this.touchJump = true;
      this.jumpQueued = true;
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      jumpButton.addEventListener(type, () => {
        this.touchJump = false;
      });
  }
  pollGamepad(): void {
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    if (!pad) {
      this.padX = this.padY = 0;
      this.padJump = false;
      this.padRun = false;
      this.previousGamepadJump = false;
      return;
    }
    const deadzone = (n: number) => (Math.abs(n) < 0.18 ? 0 : n);
    this.padX = deadzone(pad.axes[0] ?? 0);
    this.padY = deadzone(pad.axes[1] ?? 0);
    this.padJump = pad.buttons[0]?.pressed ?? false;
    if (this.padJump && !this.previousGamepadJump) {
      this.jumpQueued = true;
      this.onConfirm();
    }
    this.previousGamepadJump = this.padJump;
    const pause = pad.buttons[9]?.pressed ?? false;
    if (pause && !this.previousGamepadPause) this.onPause();
    this.previousGamepadPause = pause;
    this.padRun = pad.buttons[2]?.pressed ?? false;
    this.orbit += deadzone(pad.axes[2] ?? 0) * -0.025;
  }
  sample(yaw: number) {
    let x =
      Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
      Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) +
      this.touchX +
      this.padX;
    let z =
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
      Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) +
      this.touchY +
      this.padY;
    const len = Math.max(1, Math.hypot(x, z));
    x /= len;
    z /= len;
    const jumpPressed = this.jumpQueued;
    this.jumpQueued = false;
    return {
      x: x * Math.cos(yaw) + z * Math.sin(yaw),
      z: -x * Math.sin(yaw) + z * Math.cos(yaw),
      jumpPressed,
      jumpHeld: this.keys.has('Space') || this.touchJump || this.padJump,
      run:
        this.keys.has('ShiftLeft') ||
        this.keys.has('ShiftRight') ||
        this.padRun ||
        Math.hypot(this.touchX, this.touchY) > 0.9,
    };
  }
  clear(): void {
    this.keys.clear();
    this.jumpQueued = false;
    this.touchJump = false;
    this.touchX = this.touchY = 0;
  }
}
