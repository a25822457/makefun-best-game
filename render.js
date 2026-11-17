// Everything the player sees: the aurora tide, the lantern-keeper, the shadow foes, the HUD
// and every screen (title, boon choice, pause, game over, victory). Pure canvas 2D, drawn
// from the world state; the game logic never draws and the renderer never steps the world.
import { FIELD, FINAL_WAVE, ORB, PALETTE, FONT, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_BOON = 'boon';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CARD = { w: 280, h: 210, y: 296, gap: 36 };

/** The boon cards' rectangles in logical coordinates, shared with the click handler. */
export function boonCardRects() {
  const total = CARD.w * 3 + CARD.gap * 2;
  const x0 = (FIELD.width - total) / 2;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h, index: i }));
}

/** Which boon card (0-2) holds logical point (x, y), else -1. */
export function boonCardAt(x, y) {
  const rects = boonCardRects();
  for (const r of rects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.index;
  }
  return -1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth || FIELD.width;
    const ch = canvas.clientHeight || FIELD.height;
    const w = Math.round(cw * dpr);
    const h = Math.round(ch * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const scale = Math.min(w / FIELD.width, h / FIELD.height);
    view = { scale, ox: (w - FIELD.width * scale) / 2, oy: (h - FIELD.height * scale) / 2, dpr };
  }

  function glow(x, y, r, colour, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBackground(state) {
    const t = state.time;
    const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, '#0a1030');
    sky.addColorStop(0.55, PALETTE.sea);
    sky.addColorStop(1, '#0a1a2e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Aurora bands drifting across the sky.
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i += 1) {
      const y = 90 + i * 70 + Math.sin(t * 0.3 + i * 2.1) * 26;
      const band = ctx.createLinearGradient(0, y - 60, 0, y + 60);
      const c = [PALETTE.auroraA, PALETTE.auroraB, PALETTE.auroraC][i];
      band.addColorStop(0, 'rgba(0,0,0,0)');
      band.addColorStop(0.5, c);
      band.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = band;
      ctx.beginPath();
      ctx.moveTo(0, y - 40);
      for (let x = 0; x <= FIELD.width; x += 80) ctx.lineTo(x, y + Math.sin(x * 0.006 + t * 0.5 + i * 1.7) * 34 - 40);
      for (let x = FIELD.width; x >= 0; x -= 80) ctx.lineTo(x, y + Math.sin(x * 0.006 + t * 0.5 + i * 1.7) * 34 + 40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Stars, twinkling.
    for (const s of state.stars) {
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(s.tw));
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The sea: a dark swell along the bottom.
    const sea = ctx.createLinearGradient(0, FIELD.height - 150, 0, FIELD.height);
    sea.addColorStop(0, 'rgba(20, 60, 110, 0)');
    sea.addColorStop(1, 'rgba(16, 48, 96, 0.55)');
    ctx.fillStyle = sea;
    ctx.fillRect(0, FIELD.height - 150, FIELD.width, 150);
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 16) {
      const y = FIELD.height - 46 + Math.sin(x * 0.012 + t * 1.1) * 7;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawOrb(o) {
    glow(o.x, o.y, 26, 'rgba(255, 209, 102, 0.55)', 0.9);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(o.x, o.y, ORB.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(o.x - 2, o.y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEnemy(e) {
    const flash = e.flash > 0;
    glow(e.x, e.y, e.radius * 2.4, e.colour, 0.5);
    ctx.fillStyle = flash ? '#ffffff' : e.colour;
    if (e.kind === 'wisp') {
      // A drifting wisp: a teardrop body with a trailing tail.
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(e.x - e.radius * 0.7, e.y + e.radius * 0.4);
      ctx.quadraticCurveTo(e.x, e.y + e.radius * 2.1, e.x + e.radius * 0.7, e.y + e.radius * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(e.x - 5, e.y - 2, 2.6, 0, Math.PI * 2);
      ctx.arc(e.x + 5, e.y - 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'spitter') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + e.wobble * 0.4;
        const r = i % 2 === 0 ? e.radius + 5 : e.radius - 2;
        const x = e.x + Math.cos(a) * r;
        const y = e.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a0a1e';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'brute') {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius - 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#2a0a0a';
      ctx.fillRect(e.x - 12, e.y - 5, 9, 5);
      ctx.fillRect(e.x + 3, e.y - 5, 9, 5);
    } else {
      // The Gloomwhale: a great shadowed bulk with a glowing maw and crown spines.
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.radius + 26, e.radius - 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#241a4a';
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(e.x + i * 26 - 10, e.y - e.radius + 14);
        ctx.lineTo(e.x + i * 26, e.y - e.radius - 16);
        ctx.lineTo(e.x + i * 26 + 10, e.y - e.radius + 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(e.x - 26, e.y - 8, 7, 0, Math.PI * 2);
      ctx.arc(e.x + 26, e.y - 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1030';
      ctx.beginPath();
      ctx.arc(e.x - 26, e.y - 8, 3, 0, Math.PI * 2);
      ctx.arc(e.x + 26, e.y - 8, 3, 0, Math.PI * 2);
      ctx.fill();
      // Health bar above the whale.
      const w = 190;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 44, w, 10);
      ctx.fillStyle = '#b388ff';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 44, w * Math.max(0, e.hp / e.maxHp), 10);
    }
    if (e.kind !== 'boss' && e.hp < e.maxHp) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
      ctx.fillStyle = '#ff8fb8';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
    }
  }

  function drawPlayer(p, time) {
    const blink = p.invulnTimer > 0 && Math.floor(time * 14) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.45;
    glow(p.x, p.y, 74, 'rgba(255, 209, 102, 0.5)', 0.9);
    // The lantern: a brass-capped glass body with a flame heart.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(time * 2) * 0.06);
    ctx.fillStyle = '#8a6a2f';
    ctx.fillRect(-11, -PLAYER.radius - 4, 22, 7);
    ctx.fillStyle = 'rgba(190, 235, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, PLAYER.radius - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    const flick = 1 + Math.sin(time * 9) * 0.12;
    ctx.fillStyle = '#ff9d3c';
    ctx.beginPath();
    ctx.ellipse(0, 2, 7 * flick, 11 * flick, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.ellipse(0, 3, 3.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a2f';
    ctx.fillRect(-11, PLAYER.radius - 3, 22, 6);
    // Aim whisker toward the mouse.
    ctx.strokeStyle = 'rgba(255, 243, 196, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.angle) * 20, Math.sin(p.angle) * 20);
    ctx.lineTo(Math.cos(p.angle) * 30, Math.sin(p.angle) * 30);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawHud(state, ui) {
    const p = state.player;
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`SCORE ${state.score}`, 24, 44);
    ctx.font = `500 16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(ui.best, state.score)}`, 24, 68);
    if (state.combo >= 2) {
      ctx.fillStyle = '#ffd166';
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText(`COMBO x${state.combo}`, 24, 96);
    }
    // Wave, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(state.wave === 0 ? 'THE TIDE WAITS' : `WAVE ${state.wave} / ${FINAL_WAVE}`, FIELD.width / 2, 40);
    ctx.font = `500 15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`STARLIGHT ${state.orbsCollected}  ·  FOES SUNK ${state.kills}`, FIELD.width / 2, 64);
    // Hull hearts and dash, top right.
    ctx.textAlign = 'right';
    let hx = FIELD.width - 24;
    for (let i = 0; i < p.maxHull; i += 1) {
      ctx.font = '26px sans-serif';
      ctx.fillText(i < p.hull ? '♥' : '♡', hx, 44);
      hx -= 30;
    }
    const dashFrac = 1 - p.dashCooldownTimer / Math.max(0.01, p.dashCooldown);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(FIELD.width - 184, 56, 160, 8);
    ctx.fillStyle = dashFrac >= 1 ? '#7de8ff' : '#4f8cff';
    ctx.fillRect(FIELD.width - 184, 56, 160 * dashFrac, 8);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText(dashFrac >= 1 ? 'DASH READY  [SHIFT / RIGHT-CLICK]' : 'DASH RECHARGING', FIELD.width - 24, 84);
    // Boss bar, bottom centre.
    if (state.boss) {
      const w = 420;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8dcff';
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText('THE GLOOMWHALE', FIELD.width / 2, FIELD.height - 52);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(FIELD.width / 2 - w / 2, FIELD.height - 44, w, 12);
      ctx.fillStyle = '#b388ff';
      ctx.fillRect(FIELD.width / 2 - w / 2, FIELD.height - 44, w * Math.max(0, state.boss.hp / state.boss.maxHp), 12);
    }
    // Wave banner.
    if (state.bannerTimer > 0 && state.banner) {
      ctx.globalAlpha = Math.min(1, state.bannerTimer);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 54px ${FONT}`;
      ctx.fillText(state.banner, FIELD.width / 2, 190);
      ctx.globalAlpha = 1;
    }
    // Mute note.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText(ui.muted ? 'SOUND OFF  [M]' : 'SOUND ON  [M]  ·  PAUSE  [P]', 24, FIELD.height - 16);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }

  function titleText(text, y, size, colour, weight = 800) {
    ctx.textAlign = 'center';
    ctx.fillStyle = colour;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillText(text, FIELD.width / 2, y);
  }

  function drawTitle(state, ui) {
    ctx.fillStyle = 'rgba(5, 8, 24, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    glow(FIELD.width / 2, 250, 300, 'rgba(255, 209, 102, 0.35)', 0.8);
    titleText('LUMEN TIDE', 218, 92, '#ffe9a8');
    titleText('Keep the lantern lit. Gather the fallen starlight.', 268, 24, PALETTE.text, 500);
    titleText('Sink the shadows that rise from the deep — and the Gloomwhale at wave 10.', 300, 20, PALETTE.muted, 500);
    panel(340, 348, 600, 168);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 19px ${FONT}`;
    const lines = [
      ['MOVE', 'WASD or arrow keys'],
      ['AIM + FIRE', 'Mouse — hold to loose lantern bolts'],
      ['DASH', 'Shift or right-click — brief, untouchable, quick to return'],
      ['BETWEEN WAVES', 'Choose one of three blessings (click, or keys 1–3)'],
    ];
    lines.forEach(([k, v], i) => {
      ctx.fillStyle = '#ffd166';
      ctx.fillText(k, 372, 388 + i * 34);
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(v, 560, 388 + i * 34);
    });
    if (ui.best > 0) titleText(`BEST SCORE  ${ui.best}`, 566, 22, '#ffd166', 700);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    titleText('CLICK OR PRESS ENTER TO BEGIN', 636, 26, '#fff3c4', 700);
    ctx.globalAlpha = 1;
  }

  function drawBoon(state) {
    ctx.fillStyle = 'rgba(5, 8, 24, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    titleText(`WAVE ${state.wave} CLEARED`, 168, 44, '#7dff9e');
    titleText('The tide offers a blessing — choose one.', 210, 22, PALETTE.text, 500);
    const rects = boonCardRects();
    state.boons.forEach((boon, i) => {
      const r = rects[i];
      panel(r.x, r.y, r.w, r.h);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText(`BLESSING ${i + 1}  ·  PRESS ${i + 1}`, r.x + r.w / 2, r.y + 34);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 24px ${FONT}`;
      const words = boon.name.split(' ');
      ctx.fillText(words.join(' '), r.x + r.w / 2, r.y + 84);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `500 17px ${FONT}`;
      wrapText(boon.text, r.x + r.w / 2, r.y + 122, r.w - 44, 24);
    });
    titleText(`SCORE ${state.score}   ·   NEXT: WAVE ${Math.min(state.wave + 1, FINAL_WAVE)}`, 578, 20, PALETTE.muted, 600);
  }

  function wrapText(text, cx, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    const lines = [''];
    for (const word of words) {
      const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = test;
    }
    lines.forEach((line, i) => ctx.fillText(line, cx, y + i * lineHeight));
  }

  function drawStats(state, ui) {
    const rows = [
      ['SCORE', String(state.score)],
      ['BEST', String(Math.max(ui.best, state.score))],
      ['WAVE REACHED', `${Math.min(state.wave, FINAL_WAVE)} / ${FINAL_WAVE}`],
      ['FOES SUNK', String(state.kills)],
      ['STARLIGHT GATHERED', String(state.orbsCollected)],
    ];
    ctx.textAlign = 'left';
    rows.forEach(([k, v], i) => {
      const y = 400 + i * 34;
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 18px ${FONT}`;
      ctx.fillText(k, FIELD.width / 2 - 170, y);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 18px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(v, FIELD.width / 2 + 170, y);
      ctx.textAlign = 'left';
    });
  }

  function drawOver(state, ui) {
    ctx.fillStyle = 'rgba(10, 4, 16, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    titleText('THE LIGHT GOES OUT', 268, 62, '#ff8f8f');
    titleText('The shadows swallow the lantern — but the tide always returns.', 316, 20, PALETTE.muted, 500);
    drawStats(state, ui);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    titleText('CLICK OR PRESS ENTER TO TRY AGAIN', 606, 24, '#fff3c4', 700);
    ctx.globalAlpha = 1;
  }

  function drawWin(state, ui) {
    ctx.fillStyle = 'rgba(6, 14, 8, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    glow(FIELD.width / 2, 240, 320, 'rgba(255, 209, 102, 0.5)', 0.9);
    titleText('THE LANTERN BURNS BRIGHT', 268, 56, '#ffe9a8');
    titleText('The Gloomwhale is sunk, the starlight is home, and the tide glows again.', 316, 20, PALETTE.text, 500);
    drawStats(state, ui);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    titleText('CLICK OR PRESS ENTER TO SAIL AGAIN', 606, 24, '#fff3c4', 700);
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5, 8, 24, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    titleText('PAUSED', 330, 64, PALETTE.text);
    titleText('Press P or click to carry on.', 384, 20, PALETTE.muted, 500);
  }

  return {
    /** Paint `state` for `screen`, with `ui` = { best, aim, muted }. */
    draw(state, screen, ui) {
      resize();
      ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      ctx.save();
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      drawBackground(state);
      for (const o of state.orbs) drawOrb(o);
      for (const e of state.enemies) drawEnemy(e);
      // Player bolts: bright lantern shots.
      for (const b of state.bolts) {
        glow(b.x, b.y, 18, 'rgba(255, 233, 168, 0.7)', 0.9);
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      // Shadow bolts.
      for (const b of state.foeBolts) {
        glow(b.x, b.y, 20, 'rgba(179, 136, 255, 0.6)', 0.9);
        ctx.fillStyle = '#c9a6ff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const pt of state.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.colour;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (screen !== SCREEN_TITLE) drawPlayer(state.player, state.time);
      for (const f of state.floats) {
        ctx.globalAlpha = Math.max(0, f.life / 0.9);
        ctx.fillStyle = f.colour;
        ctx.font = `700 17px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // Screens and HUD sit above the shake.
      if (screen === SCREEN_PLAY || screen === SCREEN_BOON || screen === SCREEN_PAUSED) drawHud(state, ui);
      if (screen === SCREEN_PLAY && ui.aim) {
        ctx.strokeStyle = 'rgba(255, 243, 196, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ui.aim.x, ui.aim.y, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ui.aim.x - 16, ui.aim.y);
        ctx.lineTo(ui.aim.x - 6, ui.aim.y);
        ctx.moveTo(ui.aim.x + 6, ui.aim.y);
        ctx.lineTo(ui.aim.x + 16, ui.aim.y);
        ctx.moveTo(ui.aim.x, ui.aim.y - 16);
        ctx.lineTo(ui.aim.x, ui.aim.y - 6);
        ctx.moveTo(ui.aim.x, ui.aim.y + 6);
        ctx.lineTo(ui.aim.x, ui.aim.y + 16);
        ctx.stroke();
      }
      if (screen === SCREEN_TITLE) drawTitle(state, ui);
      if (screen === SCREEN_BOON) drawBoon(state);
      if (screen === SCREEN_PAUSED) drawPaused();
      if (screen === SCREEN_OVER) drawOver(state, ui);
      if (screen === SCREEN_WIN) drawWin(state, ui);
      // Vignette, so the edges fall away from the play.
      const vig = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(2,4,12,0.5)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    },
  };
}
