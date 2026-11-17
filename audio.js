// All sound is synthesised with WebAudio: no audio files, nothing fetched. The music is a
// slow two-oscillator pad under a pentatonic pluck that steps on the beat; every effect is a
// short oscillator or noise burst. Nothing here touches the DOM except AudioContext.
const NOTES = [220, 261.63, 329.63, 392, 440, 523.25, 587.33, 659.25];

export function createAudio() {
  let context = null;
  let master = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;
  let started = false;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, vol, low) {
    if (!context || muted) return;
    const now = context.currentTime;
    const len = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, len, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = context.createBufferSource();
    src.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now);
  }

  /** Start the ambient music. Safe to call on every user gesture; it starts only once. */
  function startMusic() {
    if (started || !ensure()) return;
    started = true;
    if (context.state === 'suspended') context.resume().catch(() => {});
    const pad = context.createOscillator();
    const pad2 = context.createOscillator();
    const padGain = context.createGain();
    pad.type = 'sine';
    pad.frequency.value = 110;
    pad2.type = 'sine';
    pad2.frequency.value = 164.81;
    padGain.gain.value = 0.05;
    pad.connect(padGain);
    pad2.connect(padGain);
    padGain.connect(master);
    pad.start();
    pad2.start();
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const note = NOTES[musicStep % NOTES.length];
      musicStep += 1;
      tone(note, 0.5, 'triangle', 0.06);
      if (musicStep % 4 === 0) tone(note / 2, 0.9, 'sine', 0.05);
    }, 420);
  }

  return {
    unlock() { ensure(); if (context && context.state === 'suspended') context.resume().catch(() => {}); },
    startMusic,
    shoot() { tone(720, 0.09, 'square', 0.05, 340); },
    pickup(combo) { tone(660 + Math.min(combo, 8) * 40, 0.14, 'sine', 0.09, 990); },
    hit() { noise(0.18, 0.16, 900); tone(160, 0.2, 'sawtooth', 0.1, 60); },
    enemyDown() { tone(520, 0.12, 'triangle', 0.08, 180); noise(0.1, 0.08, 2400); },
    dash() { noise(0.16, 0.1, 3200); },
    wave() { tone(392, 0.3, 'triangle', 0.1); tone(523.25, 0.4, 'triangle', 0.1); },
    boon() { tone(523.25, 0.15, 'sine', 0.1); tone(659.25, 0.2, 'sine', 0.1); tone(783.99, 0.3, 'sine', 0.1); },
    boss() { tone(98, 0.7, 'sawtooth', 0.14, 49); noise(0.5, 0.1, 500); },
    victory() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => window.setTimeout(() => tone(f, 0.5, 'triangle', 0.1), i * 160)); },
    defeat() { [392, 329.63, 261.63, 196].forEach((f, i) => window.setTimeout(() => tone(f, 0.45, 'triangle', 0.09), i * 200)); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    stop() { if (musicTimer !== null) window.clearInterval(musicTimer); },
  };
}
