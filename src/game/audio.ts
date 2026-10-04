class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicInterval: any = null;
  public sfxEnabled: boolean = true;
  public musicEnabled: boolean = true;
  public volume: number = 0.5;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a noise burst with filter for block breaking and walking
  private playNoise(
    duration: number,
    filterFreq: number,
    decay: number,
    gainLevel: number = 0.15
  ) {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = 1.8;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainLevel * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + decay);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch {
      // AudioContext might be blocked until user gesture
    }
  }

  // Synthesize footstep sound depending on material
  public playStep(material: 'grass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'glass') {
    switch (material) {
      case 'grass':
        this.playNoise(0.08, 480, 0.08, 0.08);
        break;
      case 'dirt':
        this.playNoise(0.07, 320, 0.07, 0.1);
        break;
      case 'stone':
        this.playNoise(0.05, 950, 0.05, 0.12);
        break;
      case 'wood':
        this.playNoise(0.09, 280, 0.08, 0.14);
        break;
      case 'sand':
        this.playNoise(0.1, 700, 0.09, 0.09);
        break;
      case 'glass':
        this.playNoise(0.04, 1800, 0.04, 0.1);
        break;
    }
  }

  // Play block break sound
  public playBlockBreak(material: 'grass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'glass') {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    // Pop tone + noise crack
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(material === 'glass' ? 800 : 160, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);

      const freq = material === 'glass' ? 2400 : material === 'stone' ? 800 : 450;
      this.playNoise(0.14, freq, 0.14, 0.22);
    } catch {
      // Ignored
    }
  }

  // Play block place sound
  public playBlockPlace(material: 'grass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'glass') {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(material === 'stone' ? 220 : 180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.2 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);

      this.playNoise(0.08, 400, 0.07, 0.12);
    } catch {
      // Ignored
    }
  }

  // Play jump sound
  public playJump() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.12 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch {
      // Ignored
    }
  }

  // Play eating crunch sound
  public playEat() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      // 3 rapid crunches followed by swallow
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          this.playNoise(0.06, 750 + Math.random() * 200, 0.05, 0.18);
        }, i * 140);
      }
      setTimeout(() => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12 * this.volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.16);
      }, 450);
    } catch {
      // Ignored
    }
  }

  // Play classic Minecraft "Oof!" hurt sound
  public playHurt() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.25 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.21);
    } catch {
      // Ignored
    }
  }

  // Play item pickup pop/ding sound
  public playPickup() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15 * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch {
      // Ignored
    }
  }

  // Play crafting success chime
  public playCraft() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = this.ctx!.currentTime + idx * 0.07;
        gain.gain.setValueAtTime(0.12 * this.volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.16);
      });
    } catch {
      // Ignored
    }
  }

  // Play triumphant level up / portal activation / achievement fanfare
  public playLevelUp() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const fanfare = [392.0, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
      fanfare.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = this.ctx!.currentTime + idx * 0.09;
        gain.gain.setValueAtTime(0.16 * this.volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.36);
      });
    } catch {
      // Ignored
    }
  }

  // Ambient gentle pentatonic notes (Minecraft C418 style)
  public startAmbientMusic() {
    if (this.musicInterval) return;
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]; // C D E G A C5

    const playRandomChord = () => {
      if (!this.musicEnabled) return;
      this.init();
      if (!this.ctx) return;

      try {
        const root = notes[Math.floor(Math.random() * notes.length)];
        const third = root * 1.25;

        [root, third].forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;

          const now = this.ctx!.currentTime + idx * 0.15;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.04 * this.volume, now + 1.2);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          osc.start(now);
          osc.stop(now + 4.8);
        });
      } catch {
        // Ignored
      }
    };

    // Play every 12 to 18 seconds gently
    this.musicInterval = setInterval(() => {
      if (Math.random() > 0.3) {
        playRandomChord();
      }
    }, 14000);
  }

  public stopAmbientMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const sound = new SoundEngine();
