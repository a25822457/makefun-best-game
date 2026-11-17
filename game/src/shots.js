// The screenshot scenes behind ?shot=start|play|boon|victory|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an autopilot that
// aims at the nearest foe, gathers starlight, flees what gets too close and dashes out of
// trouble, so the frame is what a real game looks like and the same seed always gives the
// same frame. The victory scene plays all ten waves the same way; the end scene steers
// recklessly, so it is caught out as a hurried player is.
import { BOONS, FIELD, FINAL_WAVE, PLAYER, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_BOON, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 40;
const LIMIT_SECONDS = 600;
const SAMPLE = STEP;

/** The autopilot's input for one step. `reckless` never flees, never dashes, never dodges. */
export function autopilotInput(state, reckless = false) {
  const p = state.player;
  let move = { x: 0, y: 0 };
  let aim = { x: p.x, y: p.y - 100 };
  let firing = false;
  let dash = false;

  let foe = null;
  let foeD = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < foeD) { foeD = d; foe = e; }
  }
  let orb = null;
  let orbD = Infinity;
  for (const o of state.orbs) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < orbD) { orbD = d; orb = o; }
  }

  if (foe) {
    aim = { x: foe.x, y: foe.y };
    firing = foeD < 620;
    if (!reckless && foeD < 120) {
      // Too close: back away from it.
      move = { x: (p.x - foe.x) / (foeD || 1), y: (p.y - foe.y) / (foeD || 1) };
      if (foeD < 70 && p.dashCooldownTimer <= 0) dash = true;
    } else if (foeD > 280) {
      move = { x: (foe.x - p.x) / foeD, y: (foe.y - p.y) / foeD };
    } else if (orb && orbD < 260) {
      move = { x: (orb.x - p.x) / (orbD || 1), y: (orb.y - p.y) / (orbD || 1) };
    } else {
      // Strafe around the foe at firing range.
      const px = -(foe.y - p.y) / (foeD || 1);
      const py = (foe.x - p.x) / (foeD || 1);
      move = { x: px, y: py };
    }
  } else if (orb) {
    move = { x: (orb.x - p.x) / (orbD || 1), y: (orb.y - p.y) / (orbD || 1) };
  } else {
    // Nothing to do: drift back toward the middle of the tide.
    const cx = FIELD.width / 2 - p.x;
    const cy = FIELD.height / 2 - p.y;
    const d = Math.hypot(cx, cy);
    if (d > 60) move = { x: cx / d, y: cy / d };
  }

  if (!reckless) {
    // Sidestep a shadow bolt that is about to arrive.
    for (const b of state.foeBolts) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < 110) {
        const speed = Math.hypot(b.vx, b.vy) || 1;
        const closing = ((p.x - b.x) * b.vx + (p.y - b.y) * b.vy) / (d * speed);
        if (closing > 0.6) {
          move = { x: -b.vy / speed, y: b.vx / speed };
          break;
        }
      }
    }
    // Keep off the edges while fleeing.
    if (p.x < 70) move.x = Math.abs(move.x);
    if (p.x > FIELD.width - 70) move.x = -Math.abs(move.x);
    if (p.y < 70) move.y = Math.abs(move.y);
    if (p.y > FIELD.height - 70) move.y = -Math.abs(move.y);
  }

  const len = Math.hypot(move.x, move.y);
  if (len > 1) { move.x /= len; move.y /= len; }
  return { move, aim, firing, dash };
}

/** Boons the autopilot favours, best first, when a wave is cleared mid-scene. */
const BOON_ORDER = ['twin', 'ember', 'rapid', 'glass', 'swift', 'dash', 'magnet', 'ward'];

function pickBoon(world) {
  const offered = world.state.boons;
  for (const id of BOON_ORDER) {
    if (offered.some((b) => b.id === id)) return id;
  }
  return offered[0]?.id;
}

/** Step the world with the autopilot until `stop` says enough; returns the last events.
 * With `stopAtBoon`, returns as soon as a wave is cleared and the boon choice is open,
 * instead of picking a boon and playing on. */
function simulate(world, seconds, reckless = false, stopAtBoon = false) {
  let events = 0;
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    if (state.phase === 'boon') {
      if (stopAtBoon) return events;
      const id = pickBoon(world);
      if (id) world.applyBoon(id);
      continue;
    }
    if (state.phase !== 'play') break;
    events = world.step(SAMPLE, autopilotInput(state, reckless));
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, boon, victory or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      world.startRun();
      simulate(world, PLAY_SECONDS);
      if (world.state.phase === 'play') {
        // Wait for a busy moment: a fresh wave mid-spawn reads far denser than a cleared one.
        let extra = 0;
        while (world.state.enemies.length < 6 && extra < 20 && world.state.phase === 'play') {
          simulate(world, 2);
          extra += 2;
        }
        return { screen: SCREEN_PLAY, best: world.state.score };
      }
    }
    world.reset();
    world.startRun();
    simulate(world, 12);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    // Stage wave 10 directly: the pilot fights the Gloomwhale with a fresh lantern,
    // so the frame shows the boss fight itself, not the nine waves before it.
    // A real wave-10 keeper arrives with blessings, so the staged keeper gets the
    // three a run usually holds by then (twin bolts, ember bolts, thick glass).
    world.reset();
    world.startRun();
    for (const id of ['twin', 'ember', 'glass']) {
      BOONS.find((b) => b.id === id)?.apply(world.state.player);
    }
    world.state.player.hull = world.state.player.maxHull;
    for (let w = 1; w < FINAL_WAVE; w += 1) world.nextWave();
    let fought = false;
    const steps = Math.floor(60 / SAMPLE);
    for (let i = 0; i < steps; i += 1) {
      const state = world.state;
      if (state.phase !== 'play') break;
      world.step(SAMPLE, autopilotInput(state));
      if (state.boss) {
        fought = true;
        // Hold the fight until the whale has fully swum into frame (it enters
        // from the top) and a few seconds of combat have passed.
        let held = 0;
        for (let j = 0; j < Math.floor(15 / SAMPLE); j += 1) {
          if (world.state.phase !== 'play' || !world.state.boss) break;
          world.step(SAMPLE, autopilotInput(world.state));
          held += SAMPLE;
          const b = world.state.boss; // the pilot can sink it mid-hold
          if (held >= 4 && b && b.y > 150) break;
        }
        break;
      }
    }
    if (fought && world.state.phase === 'play' && world.state.boss) return { screen: SCREEN_PLAY, best: world.state.score };
    // The whale never arrived: show the deepest play the pilot managed.
    world.reset();
    world.startRun();
    simulate(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boon') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      world.reset();
      world.startRun();
      simulate(world, 150, false, true);
      if (world.state.phase === 'boon') return { screen: SCREEN_BOON, best: world.state.score };
    }
    world.reset();
    world.startRun();
    simulate(world, 40);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'victory') {
    world.reset();
    world.startRun();
    const events = simulate(world, LIMIT_SECONDS);
    if (world.state.phase === 'win' || (events & EVENT_WIN)) {
      return { screen: SCREEN_WIN, best: world.state.score };
    }
    // The pilot fell short: show the play it reached rather than a scene it never earned.
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    world.reset();
    world.startRun();
    simulate(world, LIMIT_SECONDS, true);
    return { screen: world.state.phase === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // start (and anything else): a few seconds of live tide behind the title.
  world.reset();
  world.startRun();
  simulate(world, START_SECONDS);
  return { screen: SCREEN_TITLE, best: 0 };
}

// Keep PLAYER referenced: the pilot's dash and the player's radius shape its distances.
void PLAYER;
