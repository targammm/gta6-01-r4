// world.js — the world state and the fixed-step simulation. createWorld
// builds every subsystem around one shared state object (also exposed as
// window.__solmar); stepWorld advances it in strict system order at 1/60.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { createSeededRandom, clamp } from './random.js';
import { createRender } from './render.js';
import { createCity } from './city.js';
import { createEffects } from './effects.js';
import { createPlayer, updatePlayer, updateDriving, updateCamera } from './player.js';
import { spawnParkedCar, tryEnterCar, exitCar } from './vehicles.js';
import { createTraffic, updateTraffic, updatePedestrians } from './traffic.js';
import { createPolice, updateWantedLevel, updatePoliceChase, clearPolice } from './police.js';
import { createMissions, startMission } from './missions.js';
import { createCombat, playerShoot, playerPunch, updateEnemies } from './combat.js';
import { createHud, updateHud } from './hud.js';
import { createAudio, ensureAudio, updateEngineSound, updateSirenSound, updateMusic, setMuted } from './audio.js';
import { createInput, wasPressed, endInputStep } from './input.js';
import { loadSave, writeSave, hasSaveData, applySaveToState } from './save.js';
import { updateEffects } from './effects.js';
import { updateMissions } from './missions.js';

export function createWorld(seed) {
  const world = {
    seed,
    rng: createSeededRandom(seed),
    phase: 'title',
    elapsed: 0,
    playTime: 0,
    money: 0,
    xp: 0,
    missionsDone: 0,
    player: null,
    cars: [],
    parkedCars: [],
    enemies: [],
    nextCarId: 1,
    wanted: { level: 0, heat: 99, decayBlocked: false },
    camYaw: Math.PI,
    camPitch: 0.12,
    camPos: null,
    camLook: null,
    camSnap: true,
    driveCamOffset: 0,
    shake: 0,
    fireCooldown: 0,
    punchCooldown: 0,
    objectiveText: '',
    save: null,
    hasSave: false,
    saveTimer: 0,
    autopilot: null,
    driveInput: null,
    cameraPin: null,
    shotMode: null,
    titleT: 0,
    render: null,
    city: null,
    effects: null,
    traffic: null,
    police: null,
    missions: null,
    combat: null,
    audio: null,
    input: null,
    hud: null,
  };
  world.render = createRender(world);
  world.city = createCity(world);
  world.effects = createEffects(world);
  world.player = createPlayer(world);

  // The six stealable parked cars.
  const parked = [
    ['sedan', 36, 150, Math.PI / 2, 0xd23b2e],
    ['taxi', -84, 90, 0, undefined],
    ['sedan', -24, -30, Math.PI / 2, undefined],
    ['pickup', 96, -90, 0, 0x37a05a],
    ['sedan', -150, 36, Math.PI / 2, undefined],
    ['van', 150, -24, 0, 0xe8e0cc],
  ];
  for (const [kind, x, z, angle, color] of parked) {
    spawnParkedCar(world, kind, x, z, angle, color);
  }

  world.traffic = createTraffic(world);
  world.police = createPolice(world);
  world.missions = createMissions(world);
  world.combat = createCombat(world);
  world.audio = createAudio(world);
  world.input = createInput(world);
  world.hud = createHud(world);

  world.hasSave = hasSaveData();
  world.save = loadSave();
  applySaveToState(world);

  world.camPos = new THREE.Vector3(0, 72, 130);
  world.camLook = new THREE.Vector3(0, 10, 0);
  return world;
}

export function startGame(world) {
  world.phase = 'play';
  ensureAudio(world);
  if (!world.missions.started) {
    if (world.missionsDone >= 3) {
      world.missions.started = true;
      world.objectiveText = 'Free roam — Rico Vale owns Solmar Bay.';
    } else {
      startMission(world, Math.min(world.missionsDone, 2));
    }
  }
  writeSave(world);
}

export function respawnPlayer(world) {
  const p = world.player;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar = null;
  }
  p.mesh.visible = true;
  p.x = 0;
  p.z = 40;
  p.y = 0;
  p.vy = 0;
  p.vx = 0;
  p.vz = 0;
  p.health = 100;
  p.heading = Math.PI;
  world.camYaw = Math.PI;
  world.camSnap = true;
  world.wanted.level = 0;
  world.wanted.heat = 99;
  clearPolice(world);
  world.money = Math.max(0, world.money - 200);
  world.phase = 'play';
  writeSave(world);
}

export function restartMission(world) {
  const p = world.player;
  world.wanted.level = 0;
  world.wanted.heat = 99;
  clearPolice(world);
  p.health = 100;
  for (const e of world.missions.enemies) {
    if (!e.dead) {
      e.dead = true;
      world.render.scene.remove(e.mesh);
    }
  }
  startMission(world, world.missions.index);
}

// Autopilot for screenshot staging: steer the player's car along a loop of
// waypoints, braking early for sharp corners. Produces world.driveInput,
// which updateDriving consumes instead of the keyboard.
export function runAutopilot(world) {
  const ap = world.autopilot;
  const car = world.player.inCar;
  if (!ap || !car) {
    world.driveInput = null;
    return;
  }
  if (ap.steerOverride !== null && ap.steerOverride !== undefined) {
    const throttle = car.speed < (ap.cruiseSpeed || 29) ? 1 : 0;
    world.driveInput = { throttle, steer: ap.steerOverride, brake: false };
    return;
  }
  const target = ap.waypoints[ap.index % ap.waypoints.length];
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 10) {
    ap.index++;
    world.driveInput = { throttle: 0.6, steer: 0, brake: false };
    return;
  }
  const desired = Math.atan2(-dx, -dz);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 1.4, -1, 1);
  let throttle = 1 - clamp(Math.abs(diff), 0, 0.9);
  throttle = Math.max(0.25, throttle);
  let brake = false;
  // Look one waypoint ahead: brake from 50 m out for a sharp corner.
  const next = ap.waypoints[(ap.index + 1) % ap.waypoints.length];
  const ndx = next.x - target.x;
  const ndz = next.z - target.z;
  const nextDesired = Math.atan2(-ndx, -ndz);
  let turn = nextDesired - desired;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  if (dist < 50 && Math.abs(turn) > 0.5 && Math.abs(car.speed) > 14) {
    throttle = 0;
    if (Math.abs(car.speed) > 20) brake = true;
  }
  world.driveInput = { throttle, steer, brake };
}

export function stepWorld(world, dt) {
  world.elapsed += dt;
  const input = world.input;

  if (wasPressed(input, 'KeyM')) {
    setMuted(world, !world.audio.muted);
  }

  if (world.phase === 'title') {
    updateTraffic(world, dt);
    updatePedestrians(world, dt);
    updateEffects(world, dt);
    updateCamera(world, dt);
    if (wasPressed(input, 'Enter')) startGame(world);
    updateHud(world, dt);
    endInputStep(input);
    return;
  }

  if (world.phase === 'pause') {
    updateEffects(world, dt);
    if (wasPressed(input, 'KeyP')) world.phase = 'play';
    updateHud(world, dt);
    endInputStep(input);
    return;
  }

  if (world.phase === 'dead' || world.phase === 'busted') {
    updateEffects(world, dt);
    if (wasPressed(input, 'Enter')) respawnPlayer(world);
    updateHud(world, dt);
    endInputStep(input);
    return;
  }

  // --- play ---
  const p = world.player;
  if (input.pressed.size > 0 || input.mousePressed) ensureAudio(world);
  if (wasPressed(input, 'KeyP')) {
    world.phase = 'pause';
    updateHud(world, dt);
    endInputStep(input);
    return;
  }
  if (p.health <= 0) {
    world.phase = 'dead';
    updateEffects(world, dt);
    updateHud(world, dt);
    endInputStep(input);
    return;
  }
  if (wasPressed(input, 'KeyR')) restartMission(world);
  if (wasPressed(input, 'KeyE')) {
    if (p.inCar) exitCar(world);
    else tryEnterCar(world);
  }
  world.fireCooldown = Math.max(0, world.fireCooldown - dt);
  world.punchCooldown = Math.max(0, world.punchCooldown - dt);
  if (wasPressed(input, 'KeyF') || input.mousePressed) playerShoot(world);
  if (wasPressed(input, 'KeyV')) playerPunch(world);

  if (world.autopilot) runAutopilot(world);
  else world.driveInput = null;
  if (p.inCar) updateDriving(world, dt);
  else updatePlayer(world, dt);

  updateTraffic(world, dt);
  updatePedestrians(world, dt);
  updateWantedLevel(world, dt);
  updatePoliceChase(world, dt);
  updateMissions(world, dt);
  updateEnemies(world, dt);
  if (p.health <= 0 && world.phase === 'play') world.phase = 'dead';
  updateEffects(world, dt);
  updateCamera(world, dt);
  updateEngineSound(world);
  updateSirenSound(world);
  updateMusic(world, dt);

  world.shake *= Math.exp(-1.8 * dt);
  world.playTime += dt;
  world.saveTimer += dt;
  if (world.saveTimer >= 5) {
    world.saveTimer = 0;
    writeSave(world);
  }
  updateHud(world, dt);
  endInputStep(input);
}
