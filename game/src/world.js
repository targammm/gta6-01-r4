// world.js — world state, the fixed-step simulation order, autopilot, respawn and mission restarts.
import { PLAYER, WANTED } from './config.js';
import { createSeededRandom, dist2D } from './random.js';
import { createInput, readMoveAxes, driveAxes, wasPressed, endInputStep } from './input.js';
import { createRender } from './render.js';
import { createCity } from './city.js';
import { createEffects, updateEffects } from './effects.js';
import { createPlayer, updatePlayer, updateDriving, updateCamera } from './player.js';
import { spawnParkedCar, tryEnterCar, exitCar, nearestEnterableCar, addWanted } from './vehicles.js';
import { PALETTE } from './config.js';
import { createTraffic, updateTraffic, updatePedestrians } from './traffic.js';
import { createPolice, updateWantedLevel, updatePoliceChase } from './police.js';
import { createMissions, startMission, currentObjective, missionTargetPos, updateMissions } from './missions.js';
import { createCombat, playerShoot, playerPunch, updateEnemies } from './combat.js';
import { createHud, updateHud } from './hud.js';
import { createAudio, ensureAudio, setMuted, updateEngineSound, updateSirenSound, playGunshot, playCrash, playMissionComplete, updateMusic } from './audio.js';
import { loadSave, writeSave, applySaveToState } from './save.js';

export function createWorld(canvas, hudRoot, seed) {
  const state = {
    phase: 'title',
    elapsed: 0,
    time: 0,
    rng: createSeededRandom(seed || 20261120),
    shotMode: false,
    money: 0,
    xp: 0,
    camYaw: Math.PI,
    camPitch: 0.15,
    camShake: 0,
    camInit: false,
    messageText: '',
    messageTimer: 0,
    bannerText: '',
    bannerTimer: 0,
    promptText: '',
    objectiveText: '',
    missionTarget: null,
    autopilot: null,
    audioCrash: false,
    audioGunshot: false,
    audioMissionComplete: false,
    saveTimer: 0,
    parkedCars: [],
    trafficCars: [],
    peds: [],
    fireHeld: false,
  };
  state.render = createRender(canvas);
  state.input = createInput(canvas);
  state.city = createCity(state.render.scene, state.rng);
  state.effects = createEffects(state.render.scene);
  state.player = createPlayer(state);
  state.wanted = { level: 0, heat: 99 };
  createTraffic(state);
  createPolice(state);
  createMissions(state);
  createCombat(state);
  state.audio = createAudio();
  state.hud = createHud(hudRoot);
  const save = loadSave();
  applySaveToState(save, state);
  state.allCars = () => [...state.parkedCars, ...state.trafficCars, ...state.police.cruisers];
  state.showMessage = (text, seconds) => {
    state.messageText = text;
    state.messageTimer = seconds || 3;
  };
  state.showBanner = (text, seconds) => {
    state.bannerText = text;
    state.bannerTimer = seconds || 5;
    state.missions.bannerText = text;
    state.missions.bannerTimer = state.bannerTimer;
  };
  state.persistSave = () => {
    state.save.money = state.money;
    state.save.xp = state.xp;
    state.save.playTime = state.elapsed;
    writeSave(state.save);
  };
  // The six parked cars anyone can steal.
  spawnParkedCar(state, 'sedan', 36, 150, 0.4, 0xc23b2e);
  spawnParkedCar(state, 'taxi', -84, 90, 1.2, PALETTE.taxi);
  spawnParkedCar(state, 'sedan', -24, -30, -0.6, 0x2e6fc2);
  spawnParkedCar(state, 'pickup', 96, -90, 2.4, 0x3fae5a);
  spawnParkedCar(state, 'sedan', -150, 36, 0.9, 0xe6e6e6);
  spawnParkedCar(state, 'van', 150, -24, -1.8, 0xe8d9b0);
  state.moveAxes = { forward: 0, strafe: 0 };
  state.driveAxes = { throttle: 0, steer: 0, brake: false };
  return state;
}

export function startGame(state) {
  state.phase = 'play';
  ensureAudio(state.audio);
  const next = Math.min(state.save.missionsDone, 3);
  startMission(state, next);
}

export function respawnPlayer(state) {
  const p = state.player;
  state.money = Math.max(0, state.money - 200);
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar = null;
  }
  p.mesh.visible = true;
  p.x = PLAYER.spawnX;
  p.z = PLAYER.spawnZ;
  p.y = 0;
  p.vx = 0; p.vz = 0; p.vy = 0;
  p.health = PLAYER.maxHealth;
  p.heading = PLAYER.spawnHeading;
  state.camYaw = PLAYER.spawnHeading;
  state.camInit = false;
  state.wanted.level = 0;
  state.wanted.heat = 99;
  for (const car of state.police.cruisers) state.render.scene.remove(car.mesh);
  state.police.cruisers = [];
  if (state.police.heli) {
    state.police.heli.active = false;
    state.police.heli.mesh.visible = false;
  }
  state.phase = 'play';
  state.persistSave();
}

export function restartMission(state) {
  state.wanted.level = 0;
  state.wanted.heat = 99;
  state.player.health = PLAYER.maxHealth;
  startMission(state, state.missions.index);
}

export function runAutopilot(state, dt) {
  const ap = state.autopilot;
  if (!ap || !state.player.inCar) return;
  const car = state.player.inCar;
  const wp = ap.waypoints[ap.index];
  const d = dist2D(car.x, car.z, wp[0], wp[1]);
  if (d < 10) {
    ap.index = (ap.index + 1) % ap.waypoints.length;
    return;
  }
  const next = ap.waypoints[(ap.index + 1) % ap.waypoints.length];
  const desired = Math.atan2(-(wp[0] - car.x), -(wp[1] - car.z));
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.4));
  const nextDesired = Math.atan2(-(next[0] - wp[0]), -(next[1] - wp[1]));
  let turnDiff = Math.abs(nextDesired - desired);
  while (turnDiff > Math.PI) turnDiff = Math.PI * 2 - turnDiff;
  let throttle = 1;
  if (turnDiff > 0.5 && d < 50 && Math.abs(car.speed) > 14) throttle = 0.25;
  if (Math.abs(diff) > 1.2) throttle = Math.min(throttle, 0.4);
  state.driveAxes = { throttle, steer, brake: turnDiff > 0.5 && d < 26 && Math.abs(car.speed) > 17 };
  updateDriving(state, dt);
}

function updatePrompt(state) {
  const p = state.player;
  if (state.phase !== 'play') {
    state.promptText = '';
    return;
  }
  if (p.inCar) {
    state.promptText = 'E — GET OUT • W/S drive • Space brake';
    return;
  }
  const car = nearestEnterableCar(state, p.x, p.z);
  if (car) {
    state.promptText = car.kind === 'cruiser' ? 'Press E — TAKE THE CRUISER' : 'Press E — STEAL CAR';
  } else {
    state.promptText = '';
  }
}

function checkPedestrianHits(state) {
  const p = state.player;
  if (!p.inCar || Math.abs(p.inCar.speed) < 5) return;
  for (const ped of state.peds) {
    if (ped.hitByPlayer) continue;
    if (dist2D(ped.x, ped.z, p.inCar.x, p.inCar.z) < 1.7) {
      ped.hitByPlayer = true;
      ped.fleeTimer = 1.2;
      addWanted(state, WANTED.gains.hitPed);
      state.showMessage('You hit a pedestrian!', 3);
    }
  }
}

export function stepWorld(state, dt) {
  state.elapsed += dt;
  const input = state.input;

  if (state.phase === 'title') {
    updateTraffic(state, dt);
    updatePedestrians(state, dt);
    updateEffects(state.effects, dt);
    updateCamera(state, dt);
    updateHud(state);
    endInputStep(input);
    return;
  }
  if (state.phase === 'pause' || state.phase === 'dead' || state.phase === 'busted') {
    if (state.phase === 'pause' && wasPressed(input, 'KeyP')) {
      state.phase = 'play';
    } else if ((state.phase === 'dead' || state.phase === 'busted') && wasPressed(input, 'Enter')) {
      respawnPlayer(state);
    }
    updateEffects(state.effects, dt);
    updateHud(state);
    endInputStep(input);
    return;
  }

  // phase === 'play'
  state.moveAxes = readMoveAxes(input);
  state.driveAxes = driveAxes(input);
  ensureAudio(state.audio);
  if (wasPressed(input, 'KeyP')) {
    state.phase = 'pause';
    endInputStep(input);
    return;
  }
  if (wasPressed(input, 'KeyM')) setMuted(state.audio, !state.audio.muted);
  if (wasPressed(input, 'KeyR')) restartMission(state);
  if (wasPressed(input, 'KeyE')) {
    if (state.player.inCar) exitCar(state);
    else tryEnterCar(state);
  }
  if ((wasPressed(input, 'KeyF') || input.clicked) && !state.fireHeld) playerShoot(state);
  if (wasPressed(input, 'KeyV')) playerPunch(state);

  if (state.autopilot) runAutopilot(state, dt);
  else if (state.player.inCar) updateDriving(state, dt);
  else updatePlayer(state, dt);

  checkPedestrianHits(state);
  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  updateWantedLevel(state, dt);
  updatePoliceChase(state, dt);
  updateMissions(state, dt);
  updateEnemies(state, dt);
  if (state.player.health <= 0 && state.phase === 'play') {
    state.player.health = 0;
    state.phase = 'dead';
  }
  updateEffects(state.effects, dt);
  updateCamera(state, dt);

  if (state.audioCrash) {
    state.audioCrash = false;
    playCrash(state.audio, 0.5);
  }
  if (state.audioGunshot) {
    state.audioGunshot = false;
    playGunshot(state.audio);
  }
  if (state.audioMissionComplete) {
    state.audioMissionComplete = false;
    playMissionComplete(state.audio);
  }
  const car = state.player.inCar;
  updateEngineSound(state.audio, car ? car.speed * 3.6 : 0, !!car);
  updateSirenSound(state.audio, state.wanted.level);
  updateMusic(state.audio, dt);

  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.bannerTimer = Math.max(0, state.bannerTimer - dt);
  state.saveTimer += dt;
  if (state.saveTimer > 5) {
    state.saveTimer = 0;
    state.persistSave();
  }
  state.objectiveText = currentObjective(state);
  state.missionTarget = missionTargetPos(state);
  updatePrompt(state);
  updateHud(state);
  endInputStep(input);
}
