import type { SoundEvent } from '../core/types';

export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private sfxMuted = false;
  private bgmEnabled = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  public toggleSfx(): boolean {
    this.sfxMuted = !this.sfxMuted;
    return this.sfxMuted;
  }

  public isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public toggleBgm(): boolean {
    this.unlock();
    this.bgmEnabled = !this.bgmEnabled;
    if (this.bgmEnabled) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
    return this.bgmEnabled;
  }

  private startBgm(): void {
    if (this.bgmTimer !== null) return;
    // Pentatonic upbeat Surabaya arcade groove (no external files)
    const bassLine = [110, 110, 146.83, 130.81, 110, 110, 164.81, 146.83];
    const leadLine = [440, 0, 523.25, 587.33, 659.25, 587.33, 523.25, 392.0];
    this.bgmTimer = window.setInterval(() => {
      if (!this.bgmEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const idx = this.bgmStep % bassLine.length;

      // Bass pulse
      this.playTone(bassLine[idx], bassLine[idx] * 0.98, 0.14, 'triangle', 0.06, now);

      // Lead pluck
      const lead = leadLine[idx];
      if (lead > 0) {
        this.playTone(lead, lead, 0.09, 'square', 0.03, now);
      }

      // Light hi-hat on off-beat
      if (this.bgmStep % 2 === 1) {
        this.playNoise(0.035, 3500, 0.025, now);
      }
      this.bgmStep++;
    }, 175);
  }

  private stopBgm(): void {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  public playQueue(events: SoundEvent[]): void {
    if (this.sfxMuted || events.length === 0) return;
    if (!this.ctx || this.ctx.state !== 'running') return;

    for (const ev of events) {
      this.play(ev);
    }
  }

  public play(ev: SoundEvent): void {
    if (this.sfxMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    switch (ev) {
      case 'jump':
        this.playTone(230, 480, 0.11, 'sine', 0.14, now);
        break;
      case 'double_jump':
        this.playTone(340, 720, 0.12, 'triangle', 0.14, now);
        break;
      case 'dash':
        this.playNoise(0.11, 1400, 0.12, now);
        this.playTone(420, 180, 0.1, 'sawtooth', 0.07, now);
        break;
      case 'kibas':
        // Cloth whip whoosh
        this.playNoise(0.12, 900, 0.15, now);
        this.playTone(310, 150, 0.11, 'triangle', 0.11, now);
        break;
      case 'hit':
        // Punchy cartoon slap/thwack
        this.playTone(170, 55, 0.09, 'square', 0.16, now);
        this.playNoise(0.06, 1800, 0.14, now);
        break;
      case 'pecut':
        // Sharp wind whip crack
        this.playNoise(0.08, 2800, 0.18, now);
        this.playTone(880, 260, 0.16, 'sawtooth', 0.12, now);
        break;
      case 'ult_start':
        this.playTone(180, 780, 0.35, 'sawtooth', 0.16, now);
        this.playNoise(0.32, 1200, 0.18, now);
        break;
      case 'ult_tick':
        this.playNoise(0.07, 1600, 0.09, now);
        this.playTone(260, 390, 0.06, 'triangle', 0.08, now);
        break;
      case 'crate_hit':
        this.playTone(160, 95, 0.07, 'square', 0.12, now);
        break;
      case 'crate_break':
        this.playNoise(0.16, 750, 0.2, now);
        this.playTone(190, 65, 0.15, 'sawtooth', 0.14, now);
        break;
      case 'pickup_heal':
        this.playTone(523.25, 659.25, 0.1, 'sine', 0.14, now);
        this.playTone(659.25, 783.99, 0.14, 'sine', 0.14, now + 0.08);
        break;
      case 'pickup_kopi':
        this.playTone(440, 880, 0.12, 'triangle', 0.15, now);
        this.playTone(659.25, 1046.5, 0.15, 'triangle', 0.14, now + 0.07);
        break;
      case 'player_hurt':
        this.playTone(210, 90, 0.16, 'sawtooth', 0.16, now);
        break;
      case 'ko':
        this.playTone(300, 110, 0.22, 'sawtooth', 0.15, now);
        this.playNoise(0.14, 1000, 0.16, now);
        break;
    }
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    startTime: number
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration);

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  private playNoise(
    duration: number,
    filterFreq: number,
    volume: number,
    startTime: number
  ): void {
    if (!this.ctx) return;
    const sampleCount = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);
    filter.Q.setValueAtTime(1.1, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(startTime);
    src.stop(startTime + duration + 0.01);
  }
}
