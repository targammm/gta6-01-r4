// shots.js — deterministic screenshot staging: real simulated drives, then careful final placement.
import { PALETTE } from './config.js';
import { dist2D } from './random.js';
import { spawnParkedCar } from './vehicles.js';
import { boostDensityNear } from './traffic.js';
import { spawnPoliceCar, spawnPoliceHelicopter } from './police.js';
import { spawnEnemy, playerShoot } from './combat.js';
import { startMission, currentObjective, missionTargetPos } from './missions.js';
import { startGame } from './world.js';

export function setPlayerOnFoot(state, x, z, heading) {
  const p = state.player;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar = null;
  }
  p.mesh.visible = true;
  p.x = x;
  p.z = z;
  p.y = 0;
  p.vx = 0; p.vz = 0; p.vy = 0;
  p.heading = heading;
  state.camYaw = heading;
  state.camInit = false;
}

export function putPlayerInCar(state, car) {
  const p = state.player;
  car.driver = 'player';
  car.stolenBefore = true;
  p.inCar = car;
  p.mesh.visible = false;
  p.x = car.x;
  p.z = car.z;
  p.heading = car.angle;
  state.camYaw = car.angle;
  state.camInit = false;
}

export function driveFor(state, seconds, stepWorld) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) stepWorld(state, 1 / 60);
}

export function aimAtNearestEnemy(state) {
  const p = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = dist2D(p.x, p.z, e.x, e.z);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  if (!best) return null;
  p.heading = Math.atan2(-(best.x - p.x), -(best.z - p.z));
  state.camYaw = p.heading;
  return best;
}

export function placeVipers(state, spots) {
  for (const e of state.enemies) state.render.scene.remove(e.mesh);
  state.enemies = [];
  const out = [];
  for (const [x, z] of spots) out.push(spawnEnemy(state, x, z));
  return out;
}

function clearCruisers(state) {
  for (const car of state.police.cruisers) state.render.scene.remove(car.mesh);
  state.police.cruisers = [];
}

function placeCruiserBehind(state, cruiser, car, back, side) {
  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  const rx = -fz;
  const rz = fx;
  cruiser.x = car.x - fx * back + rx * side;
  cruiser.z = car.z - fz * back + rz * side;
  cruiser.angle = car.angle;
  cruiser.speed = car.speed;
}

function setCoverCamera(state, car) {
  const cam = state.render.camera;
  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  const rx = -fz;
  const rz = fx;
  cam.position.set(car.x + fx * 8 + rx * 2.2, 3.45, car.z + fz * 8 + rz * 2.2);
  cam.lookAt(car.x - fx * 1, 0.6, car.z - fz * 1);
}

// Remove ambient traffic/pedestrians that wandered into the cover frame.
function clearFrameArea(state, car) {
  const cam = state.render.camera;
  state.trafficCars = state.trafficCars.filter((c) => {
    const nearCam = dist2D(c.x, c.z, cam.position.x, cam.position.z) < 14;
    const nearCar = dist2D(c.x, c.z, car.x, car.z) < 11;
    if (nearCam || nearCar) {
      state.render.scene.remove(c.mesh);
      return false;
    }
    return true;
  });
  state.peds = state.peds.filter((p) => {
    if (dist2D(p.x, p.z, cam.position.x, cam.position.z) < 8) {
      state.render.scene.remove(p.mesh);
      return false;
    }
    return true;
  });
}

// Park the helicopter far enough behind the chase that it reads as a whole
// aircraft in the upper frame, spotlight shaft angled down at the pursuit.
function placeHeliForCover(state, car) {
  const heli = state.police.heli;
  if (!heli) return;
  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  heli.x = car.x - fx * 40;
  heli.z = car.z - fz * 40;
  heli.y = 12.5;
  heli.angle = car.angle + 0.6;
  heli.mesh.position.set(heli.x, heli.y, heli.z);
  heli.mesh.rotation.y = heli.angle;
}

function setProgression(state, money, xp, missionsDone) {
  state.money = money;
  state.xp = xp;
  state.save.money = money;
  state.save.xp = xp;
  state.save.missionsDone = missionsDone;
}

function stageChase(state, stepWorld) {
  setProgression(state, 400, 100, 1);
  startGame(state);
  const car = spawnParkedCar(state, 'sedan', 90, 60, Math.PI, 0xc23b2e);
  putPlayerInCar(state, car);
  const loop = [[90, 150], [-90, 150], [-90, -150], [90, -150]];
  state.autopilot = { waypoints: loop, index: 0 };
  driveFor(state, 9, stepWorld);
  state.autopilot = null;
  setProgression(state, 400, 100, 1);

  // Near flank cruisers, 8–12 m behind the player car, speeds matched.
  clearCruisers(state);
  const slots = [[7, -3], [9.5, 3.5], [11, -1]];
  const cruisers = [];
  for (const [back, side] of slots) {
    const cruiser = spawnPoliceCar(state, 'side');
    placeCruiserBehind(state, cruiser, car, back, side);
    cruisers.push(cruiser);
  }
  boostDensityNear(state, car.x, car.z, 12, 16);

  // Wanted 4: the helicopter joins for the final segment.
  state.wanted.level = 4;
  state.wanted.heat = 0;
  const heli = spawnPoliceHelicopter(state);
  heli.hoverAlt = 13;
  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  heli.x = car.x - fx * 24;
  heli.z = car.z - fz * 24;
  heli.y = 12.5;

  // Final segment: full speed (~104 km/h) through a hard turn so the tyres
  // lay skid marks and kick dust that the capture still shows.
  car.speed = 29;
  const rx = -fz;
  const rz = fx;
  const turnTarget = [car.x + fx * 70 - rx * 45, car.z + fz * 70 - rz * 45];
  state.autopilot = { waypoints: [turnTarget], index: 0 };
  driveFor(state, 0.4, stepWorld);
  state.autopilot = null;

  // Any cruiser the chase AI dragged out of the 5.5–12.5 m band gets re-slotted.
  for (let i = 0; i < cruisers.length; i++) {
    const cruiser = cruisers[i];
    const d = dist2D(cruiser.x, cruiser.z, car.x, car.z);
    if (d < 5.5 || d > 12.5) placeCruiserBehind(state, cruiser, car, slots[i][0], slots[i][1]);
  }
  setProgression(state, 400, 100, 1);
  state.wanted.level = 4;
  setCoverCamera(state, car);
  clearFrameArea(state, car);
  placeHeliForCover(state, car);
}

function stageCity(state, stepWorld) {
  setProgression(state, 400, 100, 1);
  startGame(state);
  state.wanted.level = 0;
  state.wanted.heat = 99;
  setPlayerOnFoot(state, 20, 158.5, 0);
  spawnParkedCar(state, 'taxi', 20, 155.5, Math.PI, PALETTE.taxi);
  boostDensityNear(state, 20, 150, 10, 14);
  driveFor(state, 6, stepWorld);
  setPlayerOnFoot(state, 20, 158.5, 0);
  setProgression(state, 400, 100, 1);
  // The quiet sim lets the escape step finish itself; restart mission 2 so
  // the frame shows HEAT ESCAPE live, then clear its intro banner.
  startMission(state, 1);
  state.bannerText = '';
  state.bannerTimer = 0;
  state.objectiveText = currentObjective(state);
  state.missionTarget = missionTargetPos(state);
  state.wanted.level = 1;
  state.wanted.heat = 0;
  // One cruiser down the road ahead, in frame, facing the player.
  const cruiser = spawnPoliceCar(state, 'front');
  cruiser.x = 28;
  cruiser.z = 124;
  cruiser.angle = Math.PI;
  cruiser.speed = 0;
}

function stageMission(state, stepWorld) {
  setProgression(state, 1000, 250, 2);
  startGame(state);
  boostDensityNear(state, 150, -150, 3, 5);
  setPlayerOnFoot(state, 150, -142, 0);
  state.wanted.level = 2;
  state.wanted.heat = 0;
  // Walk the harbour marker in, which starts the Viper fight step.
  driveFor(state, 0.3, stepWorld);
  // A short live exchange while the Vipers close in.
  for (let i = 0; i < 90; i++) {
    aimAtNearestEnemy(state);
    if (i % 15 === 0) {
      state.fireCooldown = 0;
      playerShoot(state);
    }
    stepWorld(state, 1 / 60);
  }
  // Restage the Vipers CLOSE — 4–5 m — for the capture frame.
  const vipers = placeVipers(state, [[150, -146.2], [146.5, -145.5], [153.5, -145.5]]);
  vipers[0].fireTimer = 0.01;
  vipers[1].fireTimer = 0.02;
  vipers[2].fireTimer = 0.03;
  setPlayerOnFoot(state, 150, -142, 0);
  state.player.health = 100;
  state.wanted.level = 2;
  state.wanted.heat = 0;
  // Final exchange: two shots in the last steps so both sides' muzzle
  // flashes are still alive when the frame is captured.
  for (let s = 0; s < 3; s++) {
    if (s !== 1) {
      state.fireCooldown = 0;
      aimAtNearestEnemy(state);
      playerShoot(state);
    }
    stepWorld(state, 1 / 60);
  }
  if (state.player.health > 79) state.player.health = 79;
  setProgression(state, 1000, 250, 2);
  state.messageText = '';
  state.messageTimer = 0;
  state.showBanner('HEAT ESCAPE COMPLETE +$600 +150 XP', 99);
}

function stageTitle(state, stepWorld) {
  boostDensityNear(state, 0, 0, 8, 10);
  driveFor(state, 6, stepWorld);
  state.bannerText = '';
  state.bannerTimer = 0;
  state.messageText = '';
  state.messageTimer = 0;
}

export function applyShotStaging(state, name, stepWorld) {
  if (name === 'chase') stageChase(state, stepWorld);
  else if (name === 'city') stageCity(state, stepWorld);
  else if (name === 'mission') stageMission(state, stepWorld);
  else if (name === 'title') stageTitle(state, stepWorld);
}
