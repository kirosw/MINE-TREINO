(function () {
  "use strict";

  class GameAudio {
    constructor() {
      this.context = null;
      this.master = null;
      this.enabled = true;
      this.lastStepTime = 0;
    }

    unlock() {
      this.ensureContext();
      if (this.context && this.context.state === "suspended") {
        this.context.resume();
      }
    }

    ensureContext() {
      if (this.context) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        this.enabled = false;
        return;
      }
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.context.destination);
    }

    playBreak() {
      this.playNoise({ duration: 0.18, gain: 0.32, frequency: 760, type: "bandpass", decay: 0.012 });
      this.playTone({ frequency: 115, duration: 0.08, type: "square", gain: 0.05 });
    }

    playPlace() {
      this.playNoise({ duration: 0.08, gain: 0.22, frequency: 260, type: "lowpass", decay: 0.01 });
      this.playTone({ frequency: 92, duration: 0.06, type: "triangle", gain: 0.08 });
    }

    playStep() {
      this.ensureContext();
      if (!this.enabled || !this.context) return;
      if (this.context.currentTime - this.lastStepTime < 0.12) return;
      this.lastStepTime = this.context.currentTime;
      this.playNoise({ duration: 0.055, gain: 0.11, frequency: 420, type: "lowpass", decay: 0.008 });
    }

    playJump() {
      this.playTone({ frequency: 165, duration: 0.12, type: "triangle", gain: 0.08, slideTo: 240 });
    }

    playModeToggle(enabled) {
      this.playTone({ frequency: enabled ? 520 : 320, duration: 0.08, type: "sine", gain: 0.08 });
      setTimeout(() => {
        this.playTone({ frequency: enabled ? 760 : 220, duration: 0.1, type: "sine", gain: 0.06 });
      }, 60);
    }

    playNoise({ duration, gain, frequency, type, decay }) {
      this.ensureContext();
      if (!this.enabled || !this.context) return;

      const sampleRate = this.context.sampleRate;
      const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }

      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const envelope = this.context.createGain();
      const now = this.context.currentTime;

      source.buffer = buffer;
      filter.type = type;
      filter.frequency.value = frequency;
      envelope.gain.setValueAtTime(gain, now);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + Math.max(decay, duration));

      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.master);
      source.start(now);
      source.stop(now + duration);
    }

    playTone({ frequency, duration, type, gain, slideTo }) {
      this.ensureContext();
      if (!this.enabled || !this.context) return;

      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const now = this.context.currentTime;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
      envelope.gain.setValueAtTime(gain, now);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.connect(envelope);
      envelope.connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration);
    }
  }

  window.VoxelAudio = new GameAudio();
})();
