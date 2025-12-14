import * as Tone from 'tone';

export class SoundManager {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.synth = null;
    this.bass = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized || !this.enabled) return;
    
    await Tone.start();
    
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.3,
        release: 0.1,
      },
    }).toDestination();
    this.synth.volume.value = -15;

    this.bass = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.1,
        release: 0.3,
      },
    }).toDestination();
    this.bass.volume.value = -12;

    this.initialized = true;
  }

  engineSound(speed, duration = 0.1) {
    if (!this.enabled || !this.initialized) return;
    const frequency = 200 + Math.abs(speed) * 100;
    this.synth.triggerAttackRelease(frequency, duration);
  }

  victory() {
    if (!this.enabled || !this.initialized) return;
    const notes = ['C5', 'E5', 'G5', 'C6'];
    notes.forEach((note, i) => {
      setTimeout(() => {
        this.synth.triggerAttackRelease(note, '0.3');
      }, i * 150);
    });
  }

  defeat() {
    if (!this.enabled || !this.initialized) return;
    const notes = ['C4', 'B3', 'A3', 'G3'];
    notes.forEach((note, i) => {
      setTimeout(() => {
        this.bass.triggerAttackRelease(note, '0.4');
      }, i * 200);
    });
  }

  levelUp() {
    if (!this.enabled || !this.initialized) return;
    this.bass.triggerAttackRelease('C2', '0.1');
    setTimeout(() => {
      this.synth.triggerAttackRelease('G4', '0.3');
    }, 100);
  }

  startRace() {
    if (!this.enabled || !this.initialized) return;
    const tones = ['A4', 'A4', 'A4', 'C5'];
    const durations = ['0.1', '0.1', '0.1', '0.3'];
    tones.forEach((tone, i) => {
      setTimeout(() => {
        this.synth.triggerAttackRelease(tone, durations[i]);
      }, i * 250);
    });
  }

  playMenuMusic() {
    if (!this.enabled || !this.initialized) return;
    if (this.ambiance) this.ambiance.stop();
    this.ambiance = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.5, release: 0.5 },
    }).toDestination();
    this.ambiance.volume.value = -20;
    this.ambiance.triggerAttack('C2');
    setTimeout(() => {
      this.ambiance.frequency.rampTo('G1', 2);
    }, 2000);
  }

  stopMenuMusic() {
    if (this.ambiance) {
      this.ambiance.triggerRelease();
      this.ambiance = null;
    }
  }

  toggleSound(enabled) {
    this.enabled = enabled;
    if (!enabled && this.ambiance) {
      this.stopMenuMusic();
    }
  }
}

export default SoundManager;
