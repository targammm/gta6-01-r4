// hud.js — the whole HUD is DOM over the canvas: money and objective top
// left, stars and health top right, mission banner and centre message,
// speed and prompt bottom left, a 2D-canvas minimap bottom right, the
// title card and the pause/dead/busted overlays. Styling lives in
// index.html; this file builds the elements and refreshes them.

import { GAME_NAME, GAME_TAGLINE, CONTROLS, WORLD } from './config.js';

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function createHud(world) {
  const root = document.getElementById('hud');
  root.innerHTML = '';

  const left = el('div', 'hud-left', root);
  const money = el('div', 'hud-money', left, '$0');
  const sub = el('div', 'hud-sub', left, '');
  const objective = el('div', 'hud-objective', left, '');

  const right = el('div', 'hud-right', root);
  const stars = el('div', 'hud-stars', right);
  const starEls = [];
  for (let i = 0; i < 5; i++) starEls.push(el('span', 'off', stars, '★'));
  const healthWrap = el('div', 'hud-health', right);
  const healthFill = el('div', 'hud-health-fill', healthWrap);
  const healthNum = el('div', 'hud-health-num', right, 'HEALTH 100');

  const banner = el('div', 'hud-banner', root, '');
  const message = el('div', 'hud-message', root, '');

  const bl = el('div', 'hud-bl', root);
  const speed = el('div', 'hud-speed', bl);
  const speedNum = el('span', 'hud-speed-num', speed, '');
  el('span', 'hud-speed-unit', speed, ' km/h');
  const prompt = el('div', 'hud-prompt', bl, '');

  const minimap = el('canvas', 'hud-minimap', root);
  minimap.width = 220;
  minimap.height = 220;

  el('div', 'hud-controls', root, 'WASD move · E enter car · F shoot · Space jump · P pause');
  const crosshair = el('div', 'hud-crosshair', root, '+');

  const title = el('div', 'hud-title', root);
  el('h1', '', title, GAME_NAME);
  el('div', 'hud-tagline', title, GAME_TAGLINE);
  el(
    'p',
    'hud-story',
    title,
    'Rico Vale rolled back into Solmar Bay with empty pockets and a long memory. ' +
      'Mara has work: move her package, outrun the Solmar Bay PD, and take the harbour ' +
      'back from the Vipers. Three jobs stand between Rico and owning this town.'
  );
  const saveInfo = el('div', 'hud-saveinfo', title, '');
  el('div', 'hud-press', title, 'PRESS ENTER TO PLAY');
  const controlsList = el('div', 'hud-title-controls', title);
  controlsList.textContent = CONTROLS.map(([k, v]) => `${k} — ${v}`).join('  ·  ');

  const overlay = el('div', 'hud-overlay', root);
  const overlayTitle = el('div', 'hud-overlay-title', overlay, '');
  const overlaySub = el('div', 'hud-overlay-sub', overlay, '');

  return {
    root,
    money,
    sub,
    objective,
    starEls,
    healthFill,
    healthNum,
    banner,
    message,
    speed,
    speedNum,
    prompt,
    minimap,
    minimapCtx: minimap.getContext('2d'),
    crosshair,
    title,
    saveInfo,
    overlay,
    overlayTitle,
    overlaySub,
    bannerTimer: 0,
    messageTimer: 0,
    lastMoney: null,
    lastSub: '',
    lastObjective: '',
  };
}

export function showBanner(world, text, seconds = 5) {
  const h = world.hud;
  if (!h) return;
  h.banner.textContent = text;
  h.bannerTimer = seconds;
}

export function showMessage(world, text, seconds = 3.5) {
  const h = world.hud;
  if (!h) return;
  h.message.textContent = text;
  h.messageTimer = seconds;
}

function clockText(world) {
  const total = (12 * 60 + Math.floor(world.elapsed / 4)) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function updateHud(world, dt) {
  const h = world.hud;
  if (!h) return;
  const p = world.player;
  const phase = world.phase;

  if (h.bannerTimer > 0) h.bannerTimer -= dt;
  if (h.messageTimer > 0) h.messageTimer -= dt;
  h.banner.style.display = h.bannerTimer > 0 ? 'block' : 'none';
  h.message.style.display = h.messageTimer > 0 ? 'block' : 'none';

  const moneyText = '$' + world.money;
  if (h.lastMoney !== moneyText) {
    h.money.textContent = moneyText;
    h.lastMoney = moneyText;
  }
  const subText = `XP ${world.xp} • MISSIONS ${world.missionsDone}/3 • ${clockText(world)}`;
  if (h.lastSub !== subText) {
    h.sub.textContent = subText;
    h.lastSub = subText;
  }
  const objText = world.objectiveText ? '◆ ' + world.objectiveText : '';
  if (h.lastObjective !== objText) {
    h.objective.textContent = objText;
    h.lastObjective = objText;
  }

  const starsOn = world.wanted.level <= 0 ? 0 : Math.min(5, Math.ceil(world.wanted.level));
  for (let i = 0; i < 5; i++) {
    const cls = i < starsOn ? 'on' : 'off';
    if (h.starEls[i].className !== cls) h.starEls[i].className = cls;
  }

  const hp = Math.max(0, Math.ceil(p.health));
  h.healthFill.style.width = hp + '%';
  h.healthFill.style.background = hp > 55 ? '#43d653' : hp > 25 ? '#f59e2c' : '#e83a2c';
  h.healthNum.textContent = 'HEALTH ' + hp;

  if (p.inCar) {
    h.speed.style.display = 'block';
    h.speedNum.textContent = String(Math.round(Math.abs(p.inCar.speed) * 3.6));
  } else {
    h.speed.style.display = 'none';
  }

  let promptText = '';
  if (phase === 'play') {
    if (p.inCar) {
      promptText = 'E — GET OUT • W/S drive • Space brake';
    } else {
      let nearest = null;
      let nd = 3.4;
      for (const car of world.cars) {
        if (car.driver) continue;
        const d = Math.hypot(car.x - p.x, car.z - p.z);
        if (d < nd) {
          nd = d;
          nearest = car;
        }
      }
      if (nearest) promptText = nearest.isPolice ? 'Press E — TAKE THE CRUISER' : 'Press E — STEAL CAR';
    }
  }
  if (h.prompt.textContent !== promptText) h.prompt.textContent = promptText;

  h.crosshair.style.display = phase === 'play' && !p.inCar ? 'block' : 'none';

  h.title.style.display = phase === 'title' ? 'block' : 'none';
  if (phase === 'title') {
    h.saveInfo.textContent = world.hasSave
      ? `Saved game: $${world.save.money} • ${world.save.missionsDone}/3 missions • ${world.save.xp} XP — press Enter to continue`
      : 'New game — no save yet';
  }

  if (phase === 'pause' || phase === 'dead' || phase === 'busted') {
    h.overlay.style.display = 'flex';
    h.overlay.className = 'hud-overlay ' + phase;
    if (phase === 'pause') {
      h.overlayTitle.textContent = 'PAUSED';
      h.overlaySub.textContent = 'Press P to resume';
    } else if (phase === 'dead') {
      h.overlayTitle.textContent = 'WASTED';
      h.overlaySub.textContent = 'Press Enter to respawn — $200 fine';
    } else {
      h.overlayTitle.textContent = 'BUSTED';
      h.overlaySub.textContent = 'Press Enter — $200 fine';
    }
  } else {
    h.overlay.style.display = 'none';
  }

  drawMinimap(world);
}

// The minimap: dark slate water/land base, the sand and sea strip along the
// south edge, avenues, translucent building blocks, then blips — traffic in
// grey, police strobing red/blue, the mission target in yellow and the
// player as a big white triangle.
export function drawMinimap(world) {
  const h = world.hud;
  if (!h || !h.minimapCtx) return;
  const ctx = h.minimapCtx;
  const S = 220 / (WORLD.half * 2);
  const mx = (x) => (x + WORLD.half) * S;
  const mz = (z) => (z + WORLD.half) * S;

  ctx.fillStyle = 'rgb(32,38,46)';
  ctx.fillRect(0, 0, 220, 220);
  // Beach and sea along the bottom (south) edge.
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(0, mz(WORLD.beachZ), 220, mz(WORLD.seaZ) - mz(WORLD.beachZ));
  ctx.fillStyle = '#3b82c4';
  ctx.fillRect(0, mz(WORLD.seaZ), 220, 220 - mz(WORLD.seaZ));
  // Avenues.
  ctx.strokeStyle = '#59626d';
  ctx.lineWidth = 5;
  for (const r of WORLD.roads) {
    ctx.beginPath();
    ctx.moveTo(mx(r), 0);
    ctx.lineTo(mx(r), 220);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, mz(r));
    ctx.lineTo(220, mz(r));
    ctx.stroke();
  }
  // Building blocks.
  ctx.fillStyle = 'rgba(160,170,185,0.28)';
  for (const b of world.city.colliders) {
    ctx.fillRect(mx(b.minX), mz(b.minZ), (b.maxX - b.minX) * S, (b.maxZ - b.minZ) * S);
  }
  // Traffic blips.
  ctx.fillStyle = '#9aa3ad';
  for (const car of world.traffic.cars) {
    ctx.beginPath();
    ctx.arc(mx(car.x), mz(car.z), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips, strobing.
  const phase = Math.floor(world.elapsed * 2.4) % 2;
  for (const car of world.police.cruisers) {
    ctx.fillStyle = phase === 0 ? '#ff4444' : '#4488ff';
    ctx.beginPath();
    ctx.arc(mx(car.x), mz(car.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  if (world.police.heli && world.police.heli.active) {
    ctx.fillStyle = phase === 0 ? '#ff4444' : '#ffffff';
    ctx.beginPath();
    ctx.arc(mx(world.police.heli.x), mz(world.police.heli.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission target.
  const target = world.missions.target;
  if (target && world.phase !== 'title') {
    ctx.fillStyle = '#ffd83d';
    ctx.beginPath();
    ctx.arc(mx(target.x), mz(target.z), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20262e';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', mx(target.x), mz(target.z) + 0.5);
  }
  // The player: a big white triangle pointing along the heading.
  const p = world.player;
  const px = mx(p.x);
  const pz = mz(p.z);
  const fx = -Math.sin(p.heading);
  const fz = -Math.cos(p.heading);
  const ang = Math.atan2(fz, fx);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, 5);
  ctx.lineTo(-6, -5);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#10131a';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}
