// The whole game state and its rules: movement, shooting, dashing, waves, the boss, boons,
// pickups, combos and collisions. Pure logic — no DOM, no canvas, no audio — so the same
// step function drives real play, the title backdrop and the deterministic screenshot scenes.
import { AMBIENT, BOONS, COMBO_MAX, COMBO_WINDOW, ENEMIES, FIELD, FINAL_WAVE, ORB, PLAYER, STEP, wavePlan } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_SHOOT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_HIT = 8;
export const EVENT_OVER = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_WIN = 64;
export const EVENT_DASH = 128;
export const EVENT_BOON = 256;
export const EVENT_BOSS = 512;

const TAU = Math.PI * 2;

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = freshState();

  function freshState() {
    return {
      time: 0,
      phase: 'title', // title | play | boon | over | win
      wave: 0,
      score: 0,
      combo: 0,
      comboTimer: 0,
      bestCombo: 0,
      kills: 0,
      orbsCollected: 0,
      orbsEarned: 0,
      player: {
        x: FIELD.width / 2, y: FIELD.height - 140, angle: -Math.PI / 2,
        hull: PLAYER.maxHull, maxHull: PLAYER.maxHull,
        speed: PLAYER.speed, fireInterval: PLAYER.fireInterval, boltDamage: PLAYER.boltDamage,
        shots: 1, magnetRadius: ORB.magnetRadius, dashCooldown: PLAYER.dashCooldown,
        dashDamage: false, invulnerable: PLAYER.invulnerable,
        fireTimer: 0, dashTimer: 0, dashCooldownTimer: 0, invulnTimer: 0, dashing: false,
      },
      enemies: [],
      bolts: [],
      foeBolts: [],
      orbs: [],
      particles: [],
      floats: [],
      stars: [],
      nebula: [],
      debris: [],
      motes: [],
      spawnQueue: [],
      waveTotal: 0,
      spawnTimer: 0,
      orbTimer: 2,
      boons: [],
      boss: null,
      shake: 0,
      banner: '',
      bannerTimer: 0,
    };
  }

  function makeStars() {
    state.stars = [];
    for (let i = 0; i < 130; i += 1) {
      const layer = random.int(0, 2); // 0 far, 1 mid, 2 near: nearer stars are bigger and drift faster
      state.stars.push({
        x: random.range(0, FIELD.width), y: random.range(0, FIELD.height),
        r: random.range(0.6, 2.2) * (0.7 + layer * 0.4), tw: random.range(0, TAU), speed: random.range(4, 18),
        layer,
      });
    }
  }

  /** Soft nebula clouds, drifting shards and glowing motes that fill the tide. */
  function makeAmbient() {
    const colours = ['#2ee6a8', '#4f8cff', '#b388ff', '#ff7ab8', '#37c8e8'];
    state.nebula = [];
    for (let i = 0; i < AMBIENT.nebulae; i += 1) {
      state.nebula.push({
        x: random.range(0, FIELD.width), y: random.range(0, FIELD.height),
        r: random.range(140, 320), colour: colours[i % colours.length],
        vx: random.range(-7, 7), vy: random.range(-4, 4), phase: random.range(0, TAU),
      });
    }
    state.debris = [];
    for (let i = 0; i < AMBIENT.debris; i += 1) {
      state.debris.push({
        x: random.range(0, FIELD.width), y: random.range(0, FIELD.height),
        r: random.range(5, 16), rot: random.range(0, TAU), vr: random.range(-0.4, 0.4),
        vx: random.range(-12, 12), vy: random.range(-6, 10),
        shade: random.range(0.10, 0.22),
      });
    }
    state.motes = [];
    for (let i = 0; i < AMBIENT.motes; i += 1) {
      state.motes.push({
        x: random.range(0, FIELD.width), y: random.range(0, FIELD.height),
        r: random.range(1.2, 2.6), tw: random.range(0, TAU),
        vx: random.range(-9, 9), vy: random.range(-5, 8),
      });
    }
  }

  function burst(x, y, colour, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, TAU);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: random.range(0.3, 0.7), max: 0.7, colour, r: random.range(2, 4.5) });
    }
  }

  function floatText(x, y, text, colour, size = 17) {
    state.floats.push({ x, y, text, colour, life: 0.9, size });
  }

  function edgeSpawn(kind) {
    // Appear at a field edge, never on top of the player.
    for (let tries = 0; tries < 12; tries += 1) {
      const side = random.int(0, 3);
      const p = { x: 0, y: 0 };
      if (side === 0) { p.x = random.range(40, FIELD.width - 40); p.y = -30; }
      if (side === 1) { p.x = random.range(40, FIELD.width - 40); p.y = FIELD.height + 30; }
      if (side === 2) { p.x = -30; p.y = random.range(40, FIELD.height - 40); }
      if (side === 3) { p.x = FIELD.width + 30; p.y = random.range(40, FIELD.height - 40); }
      if (dist2(p, state.player) > 240 * 240) return { ...p, kind };
    }
    return { x: FIELD.width / 2, y: -30, kind };
  }

  function spawnEnemy(kind) {
    const def = ENEMIES[kind];
    const at = kind === 'boss' ? { x: FIELD.width / 2, y: -80 } : edgeSpawn(kind);
    const enemy = {
      kind, x: at.x, y: at.y, hp: def.hp, maxHp: def.hp, radius: def.radius,
      speed: def.speed * random.range(0.9, 1.15), score: def.score, touch: def.touch,
      colour: def.colour, shotTimer: random.range(1, def.shotInterval ?? 99),
      burstTimer: 3, summonTimer: 6, wobble: random.range(0, TAU), flash: 0,
      chargeTimer: random.range(1.2, 2.2), telegraph: 0, charging: 0, chargeX: 0, chargeY: 0,
    };
    state.enemies.push(enemy);
    if (kind === 'boss') state.boss = enemy;
    return enemy;
  }

  function startWave(wave) {
    state.wave = wave;
    const plan = wavePlan(wave);
    state.spawnQueue = [];
    for (let i = 0; i < plan.wisps; i += 1) state.spawnQueue.push('wisp');
    for (let i = 0; i < plan.spitters; i += 1) state.spawnQueue.push('spitter');
    for (let i = 0; i < plan.brutes; i += 1) state.spawnQueue.push('brute');
    for (let i = 0; i < plan.darts; i += 1) state.spawnQueue.push('dart');
    for (let i = 0; i < plan.splitters; i += 1) state.spawnQueue.push('splitter');
    for (let i = 0; i < plan.snipers; i += 1) state.spawnQueue.push('sniper');
    // Shuffle the queue so the wave never arrives in one clump.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = random.int(0, i);
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    if (plan.boss) state.spawnQueue.push('boss');
    state.waveTotal = state.spawnQueue.length;
    state.spawnTimer = 0.6;
    state.banner = wave === FINAL_WAVE ? 'THE GLOOMWHALE' : `WAVE ${wave}`;
    state.bannerTimer = 2.2;
    state.phase = 'play';
    return plan.boss ? EVENT_BOSS : EVENT_NONE;
  }

  function rollBoons() {
    const pool = [...BOONS];
    state.boons = [];
    for (let i = 0; i < 3; i += 1) {
      const index = random.int(0, pool.length - 1);
      state.boons.push(pool.splice(index, 1)[0]);
    }
  }

  function dropOrbs(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      state.orbs.push({ x: x + random.range(-14, 14), y: y + random.range(-10, 10), vx: random.range(-30, 30), vy: random.range(-20, 40), kind: 'star' });
    }
  }

  /** A splitter freed from its shell divides into two quick motes, right where it died. */
  function spawnMote(x, y) {
    const def = ENEMIES.mote;
    state.enemies.push({
      kind: 'mote', x, y, hp: def.hp, maxHp: def.hp, radius: def.radius,
      speed: def.speed * random.range(0.9, 1.15), score: def.score, touch: def.touch,
      colour: def.colour, shotTimer: 99, burstTimer: 99, summonTimer: 99,
      wobble: random.range(0, TAU), flash: 0,
      chargeTimer: 99, telegraph: 0, charging: 0, chargeX: 0, chargeY: 0, entered: true,
    });
  }

  function killEnemy(enemy, index) {
    const mult = Math.max(1, state.combo);
    const gained = enemy.score * mult;
    state.score += gained;
    state.kills += 1;
    state.combo = Math.min(COMBO_MAX, state.combo + 1);
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboTimer = COMBO_WINDOW;
    floatText(enemy.x, enemy.y - enemy.radius, `+${gained}`, '#ffd166');
    burst(enemy.x, enemy.y, enemy.colour, enemy.kind === 'boss' ? 60 : enemy.kind === 'splitter' ? 26 : 14, 220);
    state.shake = Math.max(state.shake, enemy.kind === 'boss' ? 14 : enemy.kind === 'splitter' ? 7 : 5);
    dropOrbs(enemy.x, enemy.y, enemy.kind === 'brute' ? 3 : enemy.kind === 'boss' ? 10 : enemy.kind === 'splitter' ? 2 : 1);
    if (enemy.kind === 'boss') state.boss = null;
    if (enemy.kind === 'splitter') {
      spawnMote(enemy.x - 16, enemy.y);
      spawnMote(enemy.x + 16, enemy.y);
    }
    state.enemies.splice(index, 1);
    return EVENT_KILL;
  }

  function damagePlayer(amount, fromX, fromY) {
    const p = state.player;
    if (p.invulnTimer > 0 || p.dashing || state.phase !== 'play') return EVENT_NONE;
    p.hull -= amount;
    p.invulnTimer = p.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, 10);
    burst(p.x, p.y, '#ff5d5d', 18, 260);
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    p.x = Math.min(FIELD.width - 24, Math.max(24, p.x + (dx / d) * 36));
    p.y = Math.min(FIELD.height - 24, Math.max(24, p.y + (dy / d) * 36));
    if (p.hull <= 0) {
      p.hull = 0;
      state.phase = 'over';
      burst(p.x, p.y, '#ffd166', 50, 300);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireBolts(p, aim) {
    const base = Math.atan2(aim.y - p.y, aim.x - p.x);
    p.angle = base;
    const spread = 0.14;
    for (let i = 0; i < p.shots; i += 1) {
      const offset = (i - (p.shots - 1) / 2) * spread;
      const a = base + offset;
      state.bolts.push({
        x: p.x + Math.cos(a) * (PLAYER.radius + 8), y: p.y + Math.sin(a) * (PLAYER.radius + 8),
        vx: Math.cos(a) * PLAYER.boltSpeed, vy: Math.sin(a) * PLAYER.boltSpeed,
        damage: p.boltDamage, life: 1.4, radius: 5,
      });
    }
    p.fireTimer = p.fireInterval;
    return EVENT_SHOOT;
  }

  function stepPlay(dt, input) {
    const p = state.player;
    let events = EVENT_NONE;
    state.time += dt;

    // --- spawn the wave's queue ---
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = wavePlan(state.wave).interval;
      }
    }

    // --- ambient starlight drifts in, so there is always something to gather ---
    state.orbTimer -= dt;
    if (state.orbTimer <= 0) {
      state.orbTimer = 2.4;
      state.orbs.push({ x: random.range(40, FIELD.width - 40), y: -16, vx: 0, vy: ORB.fallSpeed, kind: 'star' });
    }

    // --- movement & dash ---
    p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dt);
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.fireTimer = Math.max(0, p.fireTimer - dt);
    const mv = input.move;
    if (input.dash && p.dashCooldownTimer <= 0 && (mv.x !== 0 || mv.y !== 0)) {
      p.dashing = true;
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldownTimer = p.dashCooldown;
      events |= EVENT_DASH;
      burst(p.x, p.y, '#7de8ff', 10, 180);
    }
    if (p.dashing) {
      p.dashTimer -= dt;
      p.x += mv.x * PLAYER.dashSpeed * dt;
      p.y += mv.y * PLAYER.dashSpeed * dt;
      if (p.dashTimer <= 0) p.dashing = false;
    } else {
      p.x += mv.x * p.speed * dt;
      p.y += mv.y * p.speed * dt;
    }
    p.x = Math.min(FIELD.width - 24, Math.max(24, p.x));
    p.y = Math.min(FIELD.height - 24, Math.max(24, p.y));

    // --- firing ---
    if (input.firing && p.fireTimer <= 0) events |= fireBolts(p, input.aim);
    else if (!input.firing) p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);

    // --- player bolts ---
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const b = state.bolts[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bolts.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        const rr = e.radius + b.radius;
        if (dist2(b, e) < rr * rr) {
          e.hp -= b.damage;
          e.flash = 0.12;
          burst(b.x, b.y, '#ffe9a8', 3, 120);
          state.bolts.splice(i, 1);
          if (e.hp <= 0) events |= killEnemy(e, j);
          else floatText(b.x, b.y - 12, `-${b.damage}`, '#ffffff', 13);
          break;
        }
      }
    }

    // --- enemies: chase, shoot, boss patterns ---
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      e.flash = Math.max(0, e.flash - dt);
      e.wobble += dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.kind === 'wisp') {
        e.x += (dx / d) * e.speed * dt + Math.cos(e.wobble * 2.2) * 26 * dt;
        e.y += (dy / d) * e.speed * dt + Math.sin(e.wobble * 1.7) * 26 * dt;
      } else if (e.kind === 'spitter') {
        const want = 260;
        const dir = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
        e.x += (dx / d) * e.speed * dir * dt;
        e.y += (dy / d) * e.speed * dir * dt;
        e.shotTimer -= dt;
        if (e.shotTimer <= 0 && d < 520) {
          e.shotTimer = ENEMIES.spitter.shotInterval * random.range(0.9, 1.2);
          state.foeBolts.push({ x: e.x, y: e.y, vx: (dx / d) * ENEMIES.spitter.boltSpeed, vy: (dy / d) * ENEMIES.spitter.boltSpeed, life: 4, radius: 7 });
        }
      } else if (e.kind === 'brute') {
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
      } else if (e.kind === 'dart') {
        // Drift in, lock on with a flash, then charge straight at the lantern.
        if (e.charging > 0) {
          e.charging -= dt;
          e.x += e.chargeX * 520 * dt;
          e.y += e.chargeY * 520 * dt;
        } else if (e.telegraph > 0) {
          e.telegraph -= dt;
          e.flash = 0.08;
          if (e.telegraph <= 0) {
            e.charging = 0.5;
            e.chargeX = dx / d;
            e.chargeY = dy / d;
          }
        } else {
          e.chargeTimer -= dt;
          e.x += (dx / d) * e.speed * dt + Math.cos(e.wobble * 2.4) * 20 * dt;
          e.y += (dy / d) * e.speed * dt + Math.sin(e.wobble * 1.9) * 20 * dt;
          if (e.chargeTimer <= 0 && d < 460) {
            e.telegraph = 0.45;
            e.chargeTimer = random.range(1.8, 2.6);
          }
        }
      } else if (e.kind === 'splitter') {
        e.x += (dx / d) * e.speed * dt + Math.cos(e.wobble * 1.6) * 18 * dt;
        e.y += (dy / d) * e.speed * dt + Math.sin(e.wobble * 1.3) * 18 * dt;
      } else if (e.kind === 'mote') {
        e.x += (dx / d) * e.speed * dt + Math.cos(e.wobble * 3.1) * 34 * dt;
        e.y += (dy / d) * e.speed * dt + Math.sin(e.wobble * 2.7) * 34 * dt;
      } else if (e.kind === 'sniper') {
        // Hold a firing distance: close in when far, back off when crowded.
        const want = 380;
        const dir = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
        e.x += (dx / d) * e.speed * dir * dt + Math.cos(e.wobble * 1.1) * 22 * dt;
        e.y += (dy / d) * e.speed * dir * dt + Math.sin(e.wobble * 0.9) * 22 * dt;
        e.shotTimer -= dt;
        if (e.shotTimer <= 0 && d < 560) {
          e.shotTimer = ENEMIES.sniper.shotInterval * random.range(0.9, 1.2);
          state.foeBolts.push({ x: e.x, y: e.y, vx: (dx / d) * ENEMIES.sniper.boltSpeed, vy: (dy / d) * ENEMIES.sniper.boltSpeed, life: 4, radius: 7 });
        }
      } else if (e.kind === 'boss') {
        // Entrance: the whale dives in fast until it is fully on screen, then hunts.
        if (e.y < 120) {
          e.y += 150 * dt;
          e.x += (FIELD.width / 2 - e.x) * 0.5 * dt;
        } else {
          e.x += (dx / d) * e.speed * dt + Math.cos(e.wobble * 0.9) * 60 * dt;
          e.y += (dy / d) * e.speed * 0.6 * dt + Math.sin(e.wobble * 0.9) * 40 * dt;
        }
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = 3.2;
          for (let k = 0; k < 8; k += 1) {
            const a = (k / 8) * TAU + e.wobble;
            state.foeBolts.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 5, radius: 8 });
          }
          state.shake = Math.max(state.shake, 6);
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = 7;
          spawnEnemy('wisp');
          spawnEnemy('wisp');
        }
      }
      // Touch damage (and dash-through damage when the boon is held).
      // Once a foe has entered the tide it stays inside it: nothing may flee
      // off-screen where the player's bolts can no longer reach it.
      if (e.x > 0 && e.x < FIELD.width && e.y > 0 && e.y < FIELD.height) e.entered = true;
      if (e.entered) {
        e.x = Math.min(FIELD.width - 12, Math.max(12, e.x));
        e.y = Math.min(FIELD.height - 12, Math.max(12, e.y));
      }
      const rr = e.radius + PLAYER.radius - 4;
      if (dist2(e, p) < rr * rr) {
        if (p.dashing && p.dashDamage) {
          e.hp -= 2;
          e.flash = 0.12;
          if (e.hp <= 0) events |= killEnemy(e, i);
        } else {
          events |= damagePlayer(e.touch, e.x, e.y);
          if (state.phase !== 'play') return events;
        }
      }
    }

    // --- shadow bolts ---
    for (let i = state.foeBolts.length - 1; i >= 0; i -= 1) {
      const b = state.foeBolts[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const rr = b.radius + PLAYER.radius - 6;
      if (dist2(b, p) < rr * rr) {
        state.foeBolts.splice(i, 1);
        events |= damagePlayer(1, b.x - b.vx, b.y - b.vy);
        if (state.phase !== 'play') return events;
        continue;
      }
      if (b.life <= 0 || b.x < -30 || b.x > FIELD.width + 30 || b.y < -30 || b.y > FIELD.height + 30) state.foeBolts.splice(i, 1);
    }

    // --- orbs: drift, magnet, collect ---
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const o = state.orbs[i];
      const d = Math.hypot(p.x - o.x, p.y - o.y);
      if (d < p.magnetRadius) {
        const pull = 1 - d / (p.magnetRadius + 60);
        o.x += ((p.x - o.x) / (d || 1)) * 340 * pull * dt;
        o.y += ((p.y - o.y) / (d || 1)) * 340 * pull * dt;
      } else {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
      }
      if (d < PLAYER.radius + ORB.radius + 6) {
        state.orbs.splice(i, 1);
        state.orbsCollected += 1;
        state.orbsEarned += ORB.score;
        state.score += ORB.score;
        burst(o.x, o.y, '#ffd166', 5, 140);
        events |= EVENT_PICKUP;
        continue;
      }
      if (o.y > FIELD.height + 24 || o.x < -24 || o.x > FIELD.width + 24) state.orbs.splice(i, 1);
    }

    // --- combo decay, particles, floats, banner, shake ---
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    state.shake = Math.max(0, state.shake - dt * 26);
    updateFx(dt);

    // --- wave clear: boss dead on the final wave wins the game ---
    if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
      if (state.wave >= FINAL_WAVE) {
        state.phase = 'win';
        state.score += 500;
        return events | EVENT_WIN;
      }
      rollBoons();
      state.phase = 'boon';
      return events | EVENT_WAVE_CLEAR;
    }
    return events;
  }

  function updateFx(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floats.length - 1; i >= 0; i -= 1) {
      const f = state.floats[i];
      f.y -= 42 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floats.splice(i, 1);
    }
    for (const s of state.stars) {
      s.tw += dt * 1.4;
      s.y += s.speed * dt * (0.06 + s.layer * 0.09);
      if (s.y > FIELD.height + 4) { s.y = -4; s.x = random.range(0, FIELD.width); }
    }
    for (const n of state.nebula) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.phase += dt * 0.2;
      const m = n.r + 40;
      if (n.x < -m) n.x = FIELD.width + m;
      if (n.x > FIELD.width + m) n.x = -m;
      if (n.y < -m) n.y = FIELD.height + m;
      if (n.y > FIELD.height + m) n.y = -m;
    }
    for (const db of state.debris) {
      db.x += db.vx * dt;
      db.y += db.vy * dt;
      db.rot += db.vr * dt;
      if (db.x < -24) db.x = FIELD.width + 24;
      if (db.x > FIELD.width + 24) db.x = -24;
      if (db.y < -24) db.y = FIELD.height + 24;
      if (db.y > FIELD.height + 24) db.y = -24;
    }
    for (const mo of state.motes) {
      mo.tw += dt * 1.8;
      mo.x += mo.vx * dt;
      mo.y += mo.vy * dt;
      if (mo.x < -8) mo.x = FIELD.width + 8;
      if (mo.x > FIELD.width + 8) mo.x = -8;
      if (mo.y < -8) mo.y = FIELD.height + 8;
      if (mo.y > FIELD.height + 8) mo.y = -8;
    }
  }

  return {
    state,
    reset() {
      const kept = state.stars;
      Object.assign(state, freshState());
      state.stars = kept.length > 0 ? kept : state.stars;
      makeStars();
      makeAmbient();
    },
    startRun() {
      this.reset();
      startWave(1);
    },
    /** Begin the next wave after a boon is chosen. */
    nextWave() {
      startWave(state.wave + 1);
    },
    applyBoon(id) {
      const boon = state.boons.find((b) => b.id === id);
      if (!boon) return EVENT_NONE;
      boon.apply(state.player);
      state.boons = [];
      state.phase = 'play';
      this.nextWave();
      return EVENT_BOON;
    },
    /** Advance the world one fixed step. `input` is { move, aim, firing, dash }. */
    step(dt, input) {
      if (state.phase === 'play') return stepPlay(dt, input);
      if (state.phase === 'title') {
        state.time += dt;
        updateFx(dt);
        return EVENT_NONE;
      }
      return EVENT_NONE;
    },
  };
}

/** The fixed step, re-exported for the loop and the shot stager. */
export { STEP };
