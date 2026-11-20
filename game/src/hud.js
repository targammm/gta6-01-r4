// hud.js — DOM HUD (money, stars, health, objective, prompts) and the canvas minimap.
import { GAME_NAME, GAME_TAGLINE, CONTROLS } from './config.js';
import { clamp } from './random.js';

function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (parent) parent.appendChild(node);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createHud(root) {
  root.innerHTML = '';
  const hud = { root };

  const topLeft = el('div', 'hud-topleft', root);
  hud.topLeft = topLeft;
  hud.money = el('div', 'hud-money', topLeft, '$0');
  hud.sub = el('div', 'hud-sub', topLeft, '');
  hud.objective = el('div', 'hud-objective', topLeft, '');

  const topRight = el('div', 'hud-topright', root);
  hud.topRight = topRight;
  hud.stars = el('div', 'hud-stars', topRight, '');
  const healthWrap = el('div', 'hud-healthwrap', topRight);
  hud.healthBar = el('div', 'hud-healthbar', healthWrap);
  hud.healthText = el('div', 'hud-healthtext', topRight, '');

  hud.banner = el('div', 'hud-banner', root, '');
  hud.message = el('div', 'hud-message', root, '');

  const bottomLeft = el('div', 'hud-bottomleft', root);
  hud.bottomLeft = bottomLeft;
  hud.speed = el('div', 'hud-speed', bottomLeft, '');
  hud.prompt = el('div', 'hud-prompt', bottomLeft, '');

  hud.controls = el('div', 'hud-controls', root, 'WASD move · E enter car · F shoot · Space jump · P pause');
  hud.crosshair = el('div', 'hud-crosshair', root, '+');

  const mapWrap = el('div', 'hud-mapwrap', root);
  hud.mapWrap = mapWrap;
  hud.minimap = document.createElement('canvas');
  hud.minimap.width = 220;
  hud.minimap.height = 220;
  hud.minimap.className = 'hud-minimap';
  mapWrap.appendChild(hud.minimap);
  hud.mapCtx = hud.minimap.getContext('2d');

  const title = el('div', 'hud-title', root);
  hud.titleCard = title;
  el('div', 'hud-title-name', title, GAME_NAME);
  el('div', 'hud-title-tag', title, GAME_TAGLINE);
  el('div', 'hud-title-story', title,
    'Rico Vale rolled back into Solmar Bay with empty pockets and a long memory. ' +
    'Mara has work: move her package, outrun the Solmar Bay PD, and take the harbour back from the Vipers. ' +
    'Three jobs stand between Rico and owning this town.');
  hud.saveInfo = el('div', 'hud-title-save', title, '');
  hud.pressEnter = el('div', 'hud-title-press', title, 'PRESS ENTER TO PLAY');
  const controlsBox = el('div', 'hud-title-controls', title);
  for (const line of CONTROLS) el('div', '', controlsBox, line);

  hud.overlay = el('div', 'hud-overlay', root, '');
  hud.overlayTitle = el('div', 'hud-overlay-title', hud.overlay, '');
  hud.overlaySub = el('div', 'hud-overlay-sub', hud.overlay, '');
  hud.overlay.style.display = 'none';

  return hud;
}

function gameClock(elapsed) {
  const totalMinutes = 12 * 60 + Math.floor(elapsed / 4);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

export function updateHud(state) {
  const hud = state.hud;
  const save = state.save;
  hud.money.textContent = '$' + state.money;
  hud.sub.textContent = 'XP ' + state.xp + ' • MISSIONS ' + save.missionsDone + '/3 • ' + gameClock(state.elapsed);
  hud.objective.textContent = state.phase === 'play' && state.objectiveText ? '◆ ' + state.objectiveText : '';

  const level = Math.floor(state.wanted.level);
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < level ? '★' : '☆';
  hud.stars.textContent = stars;
  hud.stars.style.opacity = state.phase === 'title' ? '0' : '1';

  const health = clamp(state.player.health, 0, 100);
  hud.healthBar.style.width = health + '%';
  hud.healthBar.style.background = health > 55 ? '#39d353' : health > 25 ? '#f39c12' : '#e74c3c';
  hud.healthText.textContent = 'HEALTH ' + Math.ceil(health);

  hud.banner.textContent = state.bannerText || '';
  hud.banner.style.opacity = state.bannerTimer > 0 ? '1' : '0';
  hud.message.textContent = state.messageText || '';
  hud.message.style.opacity = state.messageTimer > 0 ? '1' : '0';

  if (state.player.inCar) {
    const kmh = Math.round(Math.abs(state.player.inCar.speed) * 3.6);
    hud.speed.innerHTML = kmh + ' <span class="hud-kmh">km/h</span>';
  } else {
    hud.speed.textContent = '';
  }
  hud.prompt.textContent = state.promptText || '';
  hud.crosshair.style.display = state.phase === 'play' && !state.player.inCar ? 'block' : 'none';

  hud.titleCard.style.display = state.phase === 'title' ? 'block' : 'none';
  const chromeDisplay = state.phase === 'title' ? 'none' : '';
  hud.topLeft.style.display = chromeDisplay;
  hud.topRight.style.display = chromeDisplay;
  hud.bottomLeft.style.display = chromeDisplay;
  hud.controls.style.display = chromeDisplay;
  hud.mapWrap.style.display = chromeDisplay;
  if (state.phase === 'title') {
    hud.saveInfo.textContent = save.playTime > 0 || save.missionsDone > 0 || save.money > 0
      ? 'Saved game: $' + save.money + ' • ' + save.missionsDone + '/3 missions • ' + save.xp + ' XP — press Enter to continue'
      : 'New game — no save yet';
    hud.pressEnter.style.opacity = String(0.85 + 0.15 * Math.sin(state.elapsed * 4));
  }

  if (state.phase === 'pause') {
    hud.overlay.style.display = 'flex';
    hud.overlayTitle.textContent = 'PAUSED';
    hud.overlaySub.textContent = 'Press P to resume';
  } else if (state.phase === 'dead') {
    hud.overlay.style.display = 'flex';
    hud.overlayTitle.textContent = 'WASTED';
    hud.overlaySub.textContent = 'Press Enter to respawn — $200 hospital bill';
  } else if (state.phase === 'busted') {
    hud.overlay.style.display = 'flex';
    hud.overlayTitle.textContent = 'BUSTED';
    hud.overlaySub.textContent = 'Press Enter — $200 fine';
  } else {
    hud.overlay.style.display = 'none';
  }
  drawMinimap(state);
}

export function drawMinimap(state) {
  const ctx = state.hud.mapCtx;
  if (!ctx) return;
  const W = 220;
  const scale = W / 440;
  const toMap = (x, z) => [(x + 220) * scale, (z + 220) * scale];
  ctx.fillStyle = '#20262e';
  ctx.fillRect(0, 0, W, W);

  // Sea and beach strip along the south edge.
  const [, beachY] = toMap(0, 178);
  const [, seaY] = toMap(0, 205);
  ctx.fillStyle = '#e8d193';
  ctx.fillRect(0, beachY, W, seaY - beachY);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(0, seaY, W, W - seaY);

  // Buildings as soft blocks.
  ctx.fillStyle = 'rgba(150,155,165,0.5)';
  for (const b of state.city.buildings) {
    const [bx, bz] = toMap(b.x - b.hw, b.z - b.hd);
    ctx.fillRect(bx, bz, b.hw * 2 * scale, b.hd * 2 * scale);
  }
  // Avenues.
  ctx.strokeStyle = '#4a5058';
  ctx.lineWidth = 5;
  for (const r of [-150, -90, -30, 30, 90, 150]) {
    const [rx] = toMap(r, 0);
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, W); ctx.stroke();
    const [, rz] = toMap(0, r);
    ctx.beginPath(); ctx.moveTo(0, rz); ctx.lineTo(W, rz); ctx.stroke();
  }

  // Traffic blips.
  ctx.fillStyle = '#9aa3ad';
  for (const car of state.trafficCars) {
    const [cx, cz] = toMap(car.x, car.z);
    ctx.beginPath(); ctx.arc(cx, cz, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Pedestrian specks keep the map feeling alive.
  ctx.fillStyle = '#c8cfd6';
  for (const ped of state.peds) {
    const [px, pz] = toMap(ped.x, ped.z);
    ctx.fillRect(px - 1, pz - 1, 2, 2);
  }
  // Police blips blink red/blue.
  const blink = Math.sin(state.elapsed * 6) > 0;
  for (const car of state.police.cruisers) {
    const [cx, cz] = toMap(car.x, car.z);
    ctx.fillStyle = blink ? '#ff2a2a' : '#2a6bff';
    ctx.beginPath(); ctx.arc(cx, cz, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (state.police.heli && state.police.heli.active) {
    const [hx, hz] = toMap(state.police.heli.x, state.police.heli.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(hx, hz, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#15181d';
    ctx.font = 'bold 6px Arial';
    ctx.fillText('H', hx - 2, hz + 2);
  }
  // Mission target.
  if (state.missionTarget) {
    const [tx, tz] = toMap(state.missionTarget.x, state.missionTarget.z);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(tx, tz, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#15181d';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('!', tx - 1.5, tz + 3.5);
  }
  // Player arrow.
  const p = state.player;
  const [px, pz] = toMap(p.x, p.z);
  const a = p.heading;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px - Math.sin(a) * 9, pz - Math.cos(a) * 9);
  ctx.lineTo(px + Math.cos(a) * 5.5, pz - Math.sin(a) * 5.5);
  ctx.lineTo(px - Math.cos(a) * 5.5, pz + Math.sin(a) * 5.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
