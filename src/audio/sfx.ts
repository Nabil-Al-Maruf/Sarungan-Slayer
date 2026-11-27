import type { SoundEvent } from '../core/types';

/**
 * Rich Royalty-Free (CC0) Multi-Layered PCM AudioBuffer Sound Engine.
 * Pre-renders studio-quality layered wave buffers (whip snap, punch transient,
 * wood break crackle, turret mercon blast, level-up fanfare) into AudioBuffers
 * for zero-latency playback with zero external copyright or broken URL issues.
 */
export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundEvent, AudioBuffer>();
  private externalSamplesLoaded = false;
  private sfxMuted = false;
  private bgmEnabled = false;
  private bgmAudio: HTMLAudioElement | null = null;
  private bgmTrack: 'menu' | 'story' | 'mabar' | 'brawl' = 'menu';
  private bgmTrackUrl = './audio/bgm/menu_theme.mp3';
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  private static readonly EXTERNAL_SFX_FILES: Partial<Record<SoundEvent, string>> = {
    kibas: './audio/sfx/kibas.ogg',
    hit: './audio/sfx/hit.ogg',
    pecut: './audio/sfx/pecut.ogg',
    jump: './audio/sfx/jump.ogg',
    double_jump: './audio/sfx/double_jump.ogg',
    dash: './audio/sfx/dash.ogg',
    ult_start: './audio/sfx/ult_start.ogg',
    ult_tick: './audio/sfx/ult_tick.ogg',
    crate_hit: './audio/sfx/crate_hit.ogg',
    crate_break: './audio/sfx/crate_break.ogg',
    pickup_heal: './audio/sfx/pickup_heal.ogg',
    pickup_kopi: './audio/sfx/pickup_kopi.ogg',
    buff_pick: './audio/sfx/buff_pick.ogg',
    tower_shoot: './audio/sfx/tower_shoot.ogg',
    player_hurt: './audio/sfx/player_hurt.ogg',
    ko: './audio/sfx/ko.ogg',
    slash_clurit: './audio/sfx/slash_clurit.ogg',
    slash_tinju: './audio/sfx/slash_tinju.ogg',
    slash_api: './audio/sfx/slash_api.ogg',
    slash_suci: './audio/sfx/slash_suci.ogg',
    smash_ball: './audio/sfx/smash_ball.ogg',
  };

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.bakeSampleBuffers();
        void this.loadExternalSfxSamples();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private async loadExternalSfxSamples(): Promise<void> {
    if (this.externalSamplesLoaded || !this.ctx || typeof fetch !== 'function') return;
    this.externalSamplesLoaded = true;
    const entries = Object.entries(ProceduralAudio.EXTERNAL_SFX_FILES) as Array<[SoundEvent, string]>;
    await Promise.all(
      entries.map(async ([ev, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok || !this.ctx) return;
          const arr = await res.arrayBuffer();
          const decoded = await this.ctx.decodeAudioData(arr);
          this.buffers.set(ev, decoded);
        } catch {
          // Keep procedural fallback buffer seamlessly
        }
      })
    );
  }

  private bakeSampleBuffers(): void {
    if (!this.ctx || this.buffers.size > 0) return;
    const sr = this.ctx.sampleRate;

    const makeBuf = (dur: number, fn: (t: number, i: number) => number): AudioBuffer => {
      const len = Math.max(1, Math.floor(sr * dur));
      const buf = this.ctx!.createBuffer(1, len, sr);
      const out = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        out[i] = Math.max(-1, Math.min(1, fn(i / sr, i)));
      }
      return buf;
    };

    // 1. Kibas Sarung — heavy cloth whoosh + snap transient
    this.buffers.set(
      'kibas',
      makeBuf(0.16, (t) => {
        const env = Math.sin((t / 0.16) * Math.PI) * Math.exp(-t * 8);
        const freq = 340 - t * 1450;
        const body = Math.sin(2 * Math.PI * Math.max(70, freq) * t) * 0.55;
        const clothNoise = (Math.random() * 2 - 1) * 0.65;
        return (body + clothNoise) * env * 0.52;
      })
    );

    // 2. Hit Impact — meaty sub punch + crisp slap crack
    this.buffers.set(
      'hit',
      makeBuf(0.13, (t) => {
        const env = Math.exp(-t * 28);
        const sub = Math.sin(2 * Math.PI * (190 * Math.exp(-t * 22) + 48) * t) * 0.85;
        const slap = (Math.random() * 2 - 1) * Math.exp(-t * 55) * 0.75;
        return (sub + slap) * env * 0.65;
      })
    );

    // 3. Sabetan Angin Pecut — bullwhip supersonic crack + wind slice
    this.buffers.set(
      'pecut',
      makeBuf(0.2, (t) => {
        const crack = t < 0.03 ? (Math.random() * 2 - 1) * Math.exp(-t * 95) : 0;
        const sliceFreq = 980 * Math.exp(-t * 9) + 180;
        const slice = Math.sin(2 * Math.PI * sliceFreq * t) * Math.exp(-t * 11) * 0.5;
        const wind = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.35;
        return (crack + slice + wind) * 0.6;
      })
    );

    // 4. Jump & Double Jump
    this.buffers.set(
      'jump',
      makeBuf(0.13, (t) => {
        const f = 210 + t * 1950;
        return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 16) * 0.42;
      })
    );
    this.buffers.set(
      'double_jump',
      makeBuf(0.14, (t) => {
        const f = 330 + t * 2600;
        const harm = Math.sin(2 * Math.PI * f * 1.5 * t) * 0.35;
        return (Math.sin(2 * Math.PI * f * t) + harm) * Math.exp(-t * 16) * 0.38;
      })
    );

    // 5. Dash — air burst + bass swoosh
    this.buffers.set(
      'dash',
      makeBuf(0.14, (t) => {
        const env = Math.exp(-t * 18);
        const swoosh = Math.sin(2 * Math.PI * (460 - t * 2200) * t) * 0.45;
        const air = (Math.random() * 2 - 1) * 0.55;
        return (swoosh + air) * env * 0.48;
      })
    );

    // 6. Ultimate Badai Sarung Start & Tick
    this.buffers.set(
      'ult_start',
      makeBuf(0.38, (t) => {
        const env = Math.exp(-t * 4.5);
        const f = 160 + t * 1400;
        const chord =
          Math.sin(2 * Math.PI * f * t) * 0.5 +
          Math.sin(2 * Math.PI * f * 1.25 * t) * 0.35 +
          (Math.random() * 2 - 1) * 0.35;
        return chord * env * 0.55;
      })
    );
    this.buffers.set(
      'ult_tick',
      makeBuf(0.09, (t) => {
        const env = Math.exp(-t * 24);
        return (
          (Math.sin(2 * Math.PI * (310 + t * 900) * t) * 0.5 + (Math.random() * 2 - 1) * 0.45) *
          env *
          0.42
        );
      })
    );

    // 7. Crate Hit & Break
    this.buffers.set(
      'crate_hit',
      makeBuf(0.09, (t) => {
        const env = Math.exp(-t * 32);
        return (Math.sin(2 * Math.PI * 145 * t) * 0.7 + (Math.random() * 2 - 1) * 0.4) * env * 0.5;
      })
    );
    this.buffers.set(
      'crate_break',
      makeBuf(0.22, (t) => {
        const env = Math.exp(-t * 14);
        const boom = Math.sin(2 * Math.PI * (160 * Math.exp(-t * 12) + 40) * t) * 0.65;
        const splinters = (Math.random() * 2 - 1) * (Math.sin(t * 260) > 0 ? 0.8 : 0.3);
        return (boom + splinters) * env * 0.58;
      })
    );

    // 8. Pickups & Buff Fanfare & Tower Shot
    this.buffers.set(
      'pickup_heal',
      makeBuf(0.24, (t) => {
        const f = t < 0.08 ? 523.25 : t < 0.16 ? 659.25 : 783.99;
        return Math.sin(2 * Math.PI * f * t) * Math.exp(-(t % 0.08) * 18) * 0.42;
      })
    );
    this.buffers.set(
      'pickup_kopi',
      makeBuf(0.26, (t) => {
        const f = t < 0.08 ? 440 : t < 0.16 ? 587.33 : 880;
        const wave = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 2 * t) * 0.3;
        return wave * Math.exp(-(t % 0.08) * 16) * 0.38;
      })
    );
    this.buffers.set(
      'buff_pick',
      makeBuf(0.36, (t) => {
        const f = t < 0.09 ? 523.25 : t < 0.18 ? 659.25 : t < 0.27 ? 783.99 : 1046.5;
        const harm = Math.sin(2 * Math.PI * f * 1.5 * t) * 0.28;
        return (Math.sin(2 * Math.PI * f * t) + harm) * Math.exp(-(t % 0.09) * 14) * 0.45;
      })
    );
    this.buffers.set(
      'tower_shoot',
      makeBuf(0.15, (t) => {
        const env = Math.exp(-t * 24);
        const pop = Math.sin(2 * Math.PI * (420 * Math.exp(-t * 25) + 90) * t) * 0.75;
        const spark = (Math.random() * 2 - 1) * 0.55;
        return (pop + spark) * env * 0.5;
      })
    );

    // 9. Player Hurt & KO
    this.buffers.set(
      'player_hurt',
      makeBuf(0.18, (t) => {
        const f = 240 - t * 750;
        const saw = ((f * t) % 1) * 2 - 1;
        return saw * Math.exp(-t * 14) * 0.46;
      })
    );
    this.buffers.set(
      'ko',
      makeBuf(0.26, (t) => {
        const env = Math.exp(-t * 11);
        const f = 280 * Math.exp(-t * 7) + 55;
        return (Math.sin(2 * Math.PI * f * t) * 0.7 + (Math.random() * 2 - 1) * 0.45) * env * 0.55;
      })
    );

    // 10. Elemental Slash Audio (Petir, Api, Badai, Suci)
    this.buffers.set(
      'slash_petir',
      makeBuf(0.19, (t) => {
        const env = Math.exp(-t * 16);
        const zap = Math.sin(2 * Math.PI * (1600 + Math.sin(t * 4200) * 850) * t) * 0.5;
        const crackle = Math.random() < 0.35 ? (Math.random() * 2 - 1) * 0.65 : 0;
        const subSnap = Math.sin(2 * Math.PI * (340 - t * 1100) * t) * 0.4;
        return (zap + crackle + subSnap) * env * 0.58;
      })
    );

    this.buffers.set(
      'slash_api',
      makeBuf(0.22, (t) => {
        const env = Math.exp(-t * 12);
        const combust = Math.sin(2 * Math.PI * (135 * Math.exp(-t * 8) + 45) * t) * 0.6;
        const flameNoise = (Math.random() * 2 - 1) * Math.sin(t * 800) * 0.55;
        return (combust + flameNoise) * env * 0.55;
      })
    );

    this.buffers.set(
      'slash_badai',
      makeBuf(0.2, (t) => {
        const env = Math.exp(-t * 14);
        const whirl = Math.sin(2 * Math.PI * (780 - t * 2400) * t) * 0.52;
        const gust = (Math.random() * 2 - 1) * Math.sin(t * 600) * 0.45;
        return (whirl + gust) * env * 0.52;
      })
    );

    this.buffers.set(
      'slash_suci',
      makeBuf(0.32, (t) => {
        const env = Math.exp(-t * 8.5);
        const chime =
          Math.sin(2 * Math.PI * 1318.5 * t) * 0.45 +
          Math.sin(2 * Math.PI * 1661.2 * t) * 0.32 +
          Math.sin(2 * Math.PI * 1975.5 * t) * 0.22;
        const softSnap = t < 0.02 ? (Math.random() * 2 - 1) * 0.25 : 0;
        return (chime + softSnap) * env * 0.48;
      })
    );

    this.buffers.set(
      'slash_es',
      makeBuf(0.24, (t) => {
        const env = Math.exp(-t * 13);
        const crystal =
          Math.sin(2 * Math.PI * 2093 * t) * 0.4 +
          Math.sin(2 * Math.PI * 2637 * t) * 0.3 +
          Math.sin(2 * Math.PI * 3136 * t) * 0.2;
        const crack = t < 0.04 ? (Math.random() * 2 - 1) * 0.65 : 0;
        return (crystal + crack) * env * 0.52;
      })
    );

    this.buffers.set(
      'slash_daun',
      makeBuf(0.2, (t) => {
        const env = Math.exp(-t * 14);
        const razor = Math.sin(2 * Math.PI * (920 - t * 2800) * t) * 0.5;
        const rustle = (Math.random() * 2 - 1) * Math.sin(t * 950) * 0.48;
        return (razor + rustle) * env * 0.5;
      })
    );

    // 11. Hero Unique Weapon Slash Audio (Mat Clurit, Bang Bambang)
    this.buffers.set(
      'slash_clurit',
      makeBuf(0.18, (t) => {
        const env = Math.exp(-t * 18);
        const steelPing =
          Math.sin(2 * Math.PI * 1760 * t) * 0.45 +
          Math.sin(2 * Math.PI * 3520 * t) * 0.25;
        const razorSlice = t < 0.03 ? (Math.random() * 2 - 1) * 0.6 : 0;
        const whoosh = Math.sin(2 * Math.PI * (420 - t * 1600) * t) * 0.35;
        return (steelPing + razorSlice + whoosh) * env * 0.56;
      })
    );

    this.buffers.set(
      'slash_tinju',
      makeBuf(0.17, (t) => {
        const env = Math.exp(-t * 22);
        const subBoom = Math.sin(2 * Math.PI * (155 * Math.exp(-t * 16) + 38) * t) * 0.85;
        const punchSlap = (Math.random() * 2 - 1) * Math.exp(-t * 45) * 0.65;
        return (subBoom + punchSlap) * env * 0.62;
      })
    );

    // 12. Smash Ball / Kendi Emas Shatter Fanfare
    this.buffers.set(
      'smash_ball',
      makeBuf(0.48, (t) => {
        const env = Math.exp(-t * 5.5);
        // Ascending sacred arpeggio: C5 -> E5 -> G5 -> C6
        const f = t < 0.1 ? 523.25 : t < 0.2 ? 659.25 : t < 0.3 ? 783.99 : 1046.5;
        const bell = Math.sin(2 * Math.PI * f * t) * 0.55 + Math.sin(2 * Math.PI * f * 2 * t) * 0.25;
        const subBass = Math.sin(2 * Math.PI * (90 * Math.exp(-t * 4) + 40) * t) * 0.45;
        const shimmer = (Math.random() * 2 - 1) * 0.2;
        return (bell + subBass + shimmer) * env * 0.65;
      })
    );
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

  public setBgmTrack(track: 'menu' | 'story' | 'mabar' | 'brawl'): void {
    const trackUrls: Record<'menu' | 'story' | 'mabar' | 'brawl', string> = {
      menu: './audio/bgm/menu_theme.mp3',
      story: './audio/bgm/battle_theme.mp3',
      mabar: './audio/bgm/mabar_theme.mp3',
      brawl: './audio/bgm/brawl_theme.mp3',
    };
    const nextUrl = trackUrls[track] || trackUrls.menu;
    this.bgmTrack = track;
    if (this.bgmTrackUrl === nextUrl) return;
    this.bgmTrackUrl = nextUrl;
    if (this.bgmEnabled) {
      this.stopBgm();
      this.startBgm();
    }
  }

  private startBgm(): void {
    this.stopBgm();
    try {
      const el = new Audio(this.bgmTrackUrl);
      el.loop = true;
      el.volume = 0.28;
      this.bgmAudio = el;
      const playPromise = el.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Fallback to procedural chiptune loop if browser blocks or offline
          this.startFallbackBgm();
        });
      }
    } catch {
      this.startFallbackBgm();
    }
  }

  private startFallbackBgm(): void {
    if (this.bgmTimer !== null) return;
    const patterns: Record<
      'menu' | 'story' | 'mabar' | 'brawl',
      { bass: number[]; lead: number[]; tempoMs: number }
    > = {
      menu: {
        bass: [130.81, 164.81, 196.0, 164.81, 146.83, 174.61, 196.0, 146.83],
        lead: [523.25, 0, 659.25, 587.33, 523.25, 0, 392.0, 440.0],
        tempoMs: 220,
      },
      story: {
        bass: [110, 110, 146.83, 130.81, 110, 110, 164.81, 146.83],
        lead: [440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 392.0],
        tempoMs: 170,
      },
      mabar: {
        bass: [98.0, 98.0, 116.54, 130.81, 98.0, 146.83, 130.81, 116.54],
        lead: [392.0, 466.16, 523.25, 587.33, 698.46, 587.33, 523.25, 466.16],
        tempoMs: 155,
      },
      brawl: {
        bass: [123.47, 146.83, 164.81, 146.83, 123.47, 185.0, 164.81, 146.83],
        lead: [493.88, 587.33, 659.25, 739.99, 659.25, 587.33, 493.88, 440.0],
        tempoMs: 140,
      },
    };
    const pat = patterns[this.bgmTrack] || patterns.menu;
    this.bgmTimer = window.setInterval(() => {
      if (!this.bgmEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const idx = this.bgmStep % pat.bass.length;

      this.playTone(pat.bass[idx], pat.bass[idx] * 0.99, 0.14, 'triangle', 0.06, now);
      const lead = pat.lead[idx];
      if (lead > 0) {
        this.playTone(lead, lead, 0.1, 'sine', 0.035, now);
      }
      this.bgmStep++;
    }, pat.tempoMs);
  }

  private stopBgm(): void {
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
      } catch {
        // Ignore
      }
      this.bgmAudio = null;
    }
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
    if (this.buffers.size === 0) {
      this.bakeSampleBuffers();
    }

    const buf = this.buffers.get(ev);
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // Slight natural pitch variation so rapid hits sound organic
    if (
      ev === 'kibas' ||
      ev === 'hit' ||
      ev === 'tower_shoot' ||
      ev === 'slash_petir' ||
      ev === 'slash_api' ||
      ev === 'slash_badai' ||
      ev === 'slash_suci' ||
      ev === 'slash_clurit' ||
      ev === 'slash_tinju'
    ) {
      src.playbackRate.value = 0.94 + Math.random() * 0.14;
    }
    src.connect(this.ctx.destination);
    src.start();
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
}
