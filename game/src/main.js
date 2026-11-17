// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, boon choice, paused, game over and victory.
//
// ?seed=N fixes the tide's pattern. ?shot=start|play|boon|victory|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOON, EVENT_BOSS, EVENT_DASH, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { boonCardAt, createRenderer, SCREEN_BOON, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, aim: null, muted: audio.muted });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  function announce(text) {
    status.textContent = text;
  }

  function playEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_KILL) audio.enemyDown();
    if (events & EVENT_PICKUP) audio.pickup(world.state.combo);
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_BOSS) audio.boss();
    if (events & EVENT_BOON) audio.boon();
    if (events & EVENT_WAVE_CLEAR) audio.wave();
    if (events & EVENT_WIN) {
      audio.victory();
      if (world.state.score > best) { best = world.state.score; saveBest(best); }
      announce(`Victory! Score ${world.state.score}. Press Enter to sail again.`);
    }
    if (events & EVENT_OVER) {
      audio.defeat();
      if (world.state.score > best) { best = world.state.score; saveBest(best); }
      announce(`Game over. Score ${world.state.score}. Press Enter to try again.`);
    }
  }

  function beginRun() {
    audio.unlock();
    audio.startMusic();
    world.startRun();
    screen = SCREEN_PLAY;
    announce('The tide is rising. Gather starlight, sink the shadows.');
  }

  function chooseBoon(index) {
    const boon = world.state.boons[index];
    if (!boon) return;
    playEvents(world.applyBoon(boon.id));
    screen = SCREEN_PLAY;
    announce(`Blessing chosen: ${boon.name}. Wave ${world.state.wave} begins.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const state = world.state;

    if (input.wasPressed(ACTION_MUTE)) muted = audio.toggleMute();
    const click = input.takeClick();
    const digit = input.takeDigit();

    if (screen === SCREEN_TITLE) {
      if (input.wasPressed(ACTION_CONFIRM) || click) beginRun();
    } else if (screen === SCREEN_PLAY) {
      if (input.wasPressed(ACTION_PAUSE)) {
        screen = SCREEN_PAUSED;
        announce('Paused. Press P to carry on.');
      } else {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const events = world.step(STEP, {
            move: input.moveVector(),
            aim: input.aim,
            firing: input.firing,
            dash: input.wasPressed(ACTION_DASH),
          });
          playEvents(events);
          if (state.phase === 'boon') { screen = SCREEN_BOON; announce('Wave cleared. Choose a blessing.'); break; }
          if (state.phase === 'over') { screen = SCREEN_OVER; break; }
          if (state.phase === 'win') { screen = SCREEN_WIN; break; }
        }
      }
    } else if (screen === SCREEN_BOON) {
      if (digit >= 1 && digit <= 3) chooseBoon(digit - 1);
      else if (click) {
        const index = boonCardAt(click.x, click.y);
        if (index >= 0) chooseBoon(index);
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.wasPressed(ACTION_PAUSE) || click) {
        screen = SCREEN_PLAY;
        announce('Back on the tide.');
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (input.wasPressed(ACTION_CONFIRM) || click) beginRun();
    }

    renderer.draw(state, screen, { best, aim: input.aim, muted });
    input.endFrame();
  }

  announce('Lumen Tide. Press Enter to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
