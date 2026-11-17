// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The last wave. Clearing wave 10 (the Gloomwhale) relights the Great Lantern: you win. */
export const FINAL_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 320,
  fireInterval: 0.22,
  boltSpeed: 640,
  boltDamage: 1,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 2.4,
  invulnerable: 1.2,
  maxHull: 3,
};

export const ENEMIES = {
  wisp: { radius: 14, hp: 1, speed: 95, score: 25, touch: 1, colour: '#b388ff' },
  spitter: { radius: 16, hp: 2, speed: 70, score: 50, touch: 1, colour: '#ff7ab8', shotInterval: 2.4, boltSpeed: 170 },
  brute: { radius: 26, hp: 6, speed: 48, score: 100, touch: 1, colour: '#ff5d5d' },
  boss: { radius: 64, hp: 78, speed: 42, score: 1000, touch: 2, colour: '#7a5cff' },
};

export const ORB = { radius: 9, score: 10, magnetRadius: 170, fallSpeed: 46 };

/** Wave budgets: how many of each foe a wave sends, and how fast they arrive. */
export function wavePlan(wave) {
  const w = Math.min(wave, FINAL_WAVE);
  return {
    wisps: 4 + w * 2,
    spitters: wave >= 2 ? 1 + Math.floor(w / 2) : 0,
    brutes: wave >= 3 ? Math.floor((w - 1) / 2) : 0,
    boss: wave === FINAL_WAVE,
    interval: Math.max(0.35, 1.05 - w * 0.06),
  };
}

/** Boons offered between waves: one clear job each, picked by click or keys 1-3. */
export const BOONS = [
  { id: 'twin', name: 'Twin Lanterns', text: 'Fire a second bolt beside every shot.', apply: (p) => { p.shots += 1; } },
  { id: 'swift', name: 'Swift Current', text: 'Move 18% faster through the tide.', apply: (p) => { p.speed *= 1.18; } },
  { id: 'rapid', name: 'Rapid Wick', text: 'Fire 22% faster.', apply: (p) => { p.fireInterval *= 0.78; } },
  { id: 'glass', name: 'Thick Glass', text: 'Gain a hull heart, up to 5, and mend one.', apply: (p) => { p.maxHull = Math.min(5, p.maxHull + 1); p.hull = Math.min(p.maxHull, p.hull + 1); } },
  { id: 'magnet', name: 'Magnet Tide', text: 'Starlight drifts to you from much further away.', apply: (p) => { p.magnetRadius *= 1.6; } },
  { id: 'ember', name: 'Ember Bolts', text: 'Bolts hit 50% harder.', apply: (p) => { p.boltDamage += 0.5; } },
  { id: 'dash', name: 'Dash Echo', text: 'Dash recharges 40% faster and hurts foes you pass through.', apply: (p) => { p.dashCooldown *= 0.6; p.dashDamage = true; } },
  { id: 'ward', name: 'Warding Glow', text: 'After a hit you are safe for 1 extra second.', apply: (p) => { p.invulnerable += 1; } },
];

export const COMBO_WINDOW = 3;
export const COMBO_MAX = 8;

export const PALETTE = {
  deep: '#070b1e',
  sea: '#0d1b3a',
  auroraA: '#2ee6a8',
  auroraB: '#4f8cff',
  auroraC: '#b388ff',
  lantern: '#ffd166',
  lanternCore: '#fff3c4',
  text: '#f2f5ff',
  muted: '#9aa7c7',
  panel: 'rgba(10, 16, 38, 0.82)',
  panelEdge: 'rgba(120, 170, 255, 0.35)',
  danger: '#ff5d5d',
  heal: '#7dff9e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-tide.best';
