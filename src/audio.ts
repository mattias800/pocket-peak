/** Small original Web Audio score and synthesized effects; no downloaded assets. */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  muted = false;
  unlock(): void {
    this.context ??= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.context.destination);
    }
    void this.context.resume();
  }
  toggle(): boolean {
    this.unlock();
    this.muted = !this.muted;
    return this.muted;
  }
  private tone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
  ): void {
    if (!this.context || !this.master || this.muted) return;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  effect(
    kind: 'jump' | 'double' | 'coin' | 'fragment' | 'hurt' | 'bounce' | 'win' | 'stomp',
  ): void {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const notes = {
      jump: [330, 480],
      double: [480, 660],
      coin: [880, 1320],
      fragment: [523, 659, 784, 1047],
      hurt: [180, 130, 90],
      bounce: [220, 440, 880],
      win: [523, 659, 784, 1047, 784, 1047, 1318],
      stomp: [140, 280],
    }[kind];
    notes.forEach((note, index) =>
      this.tone(note, now + index * 0.075, 0.16, 0.35, kind === 'hurt' ? 'triangle' : 'sine'),
    );
  }
  update(active: boolean): void {
    if (!this.context || this.muted || !active) {
      this.nextBeat = 0;
      return;
    }
    const now = this.context.currentTime;
    if (!this.nextBeat || this.nextBeat < now - 0.5) this.nextBeat = now + 0.05;
    // C-major pentatonic. Scheduled slightly ahead, independent of frame rate.
    const melody = [
      76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 72, 0, 67, 0, 72, 0, 76, 0, 79, 81, 84, 0, 81, 79, 76, 0,
      74, 0, 72, 0, 0, 0,
    ];
    while (this.nextBeat < now + 0.12) {
      const note = melody[this.beat % melody.length];
      if (note) this.tone(440 * 2 ** ((note - 69) / 12), this.nextBeat, 0.22, 0.12, 'triangle');
      if (this.beat % 4 === 0)
        this.tone(
          [130.81, 164.81, 174.61, 196][Math.floor(this.beat / 8) % 4],
          this.nextBeat,
          0.4,
          0.13,
        );
      this.nextBeat += 0.23;
      this.beat++;
    }
  }
}
