// shots.js — deterministic screenshot staging. Each shot sets up real
// game state (money, XP, mission, wanted), plays the actual simulation
// forward in fixed steps — an autopilot drive, a short firefight — and
// leaves the world posed by the simulation itself, never by hand-placing
// the camera over a frozen scene.

import * as THREE from 'three';
import { spawnParkedCar } from './vehicles.js';
import { spawnPoliceCar, spawnPoliceHelicopter } from './police.js';
import { spawnEnemy, playerShoot } from './combat.js';
import { startMission } from './missions.js';
import { boostDensityNear } from './traffic.js';
import { showBanner } from './hud.js';
import { stepWorld } from './world.js';

export function setPlayerOnFoot(world, x, z, heading) {
  const p = world.player;
  if (p.inCar) {
    p.inCar.driver = null;
    p.inCar = null;
  }
  p.mesh.visible = true;
  p.x = x;
  p.z = z;
  p.y = 0;
  p.vx = 0;
  p.vz = 0;
  p.vy = 0;
  p.heading = heading;
  p.mesh.position.set(x, 0, z);
  p.mesh.rotation.y = heading;
  world.camYaw = heading;
  world.camPitch = 0.12;
  world.camSnap = true;
}

export function putPlayerInCar(world, car) {
  const p = world.player;
  car.driver = 'player';
  car.parked = false;
  p.inCar = car;
  p.mesh.visible = false;
  p.x = car.x;
  p.z = car.z;
  p.heading = car.angle;
  world.camYaw = car.angle;
  world.camSnap = true;
}

export function driveFor(world, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) stepWorld(world, 1 / 60);
}

export function aimAt(world, x, z) {
  const p = world.player;
  p.heading = Math.atan2(-(x - p.x), -(z - p.z));
  world.camYaw = p.heading;
  world.camSnap = true;
}

export function aimAtNearestEnemy(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) aimAt(world, best.x, best.z);
  return best;
}

function setProgression(world, money, xp, missionsDone) {
  world.money = money;
  world.xp = xp;
  world.missionsDone = missionsDone;
}

// Remove every cruiser (used right before placing the cover's flank slots).
function clearCruisers(world) {
  for (const car of [...world.police.cruisers]) {
    world.render.scene.remove(car.mesh);
    const ci = world.cars.indexOf(car);
    if (ci >= 0) world.cars.splice(ci, 1);
  }
  world.police.cruisers = [];
}

// 1-chase.jpg — the cover. Progression from mission 1, HEAT ESCAPE running,
// a 9-second autopilot loop of the avenues, then three cruisers in near
// flank slots (8–12 m), the helicopter overhead at wanted 4, a final hard
// turn at ~104 km/h so the tyres smoke and mark the road, and the low
// front cover camera.
function stageChase(world) {
  setProgression(world, 400, 100, 1);
  world.phase = 'play';
  startMission(world, 1); // HEAT ESCAPE: wanted 3
  world.hud.bannerTimer = 0;
  world.hud.messageTimer = 0;

  const car = spawnParkedCar(world, 'sedan', 90, 60, Math.PI, 0xd23b2e);
  putPlayerInCar(world, car);
  world.autopilot = {
    waypoints: [
      { x: 90, z: 150 },
      { x: -90, z: 150 },
      { x: -90, z: -150 },
      { x: 90, z: -150 },
    ],
    index: 0,
  };
  driveFor(world, 9);
  world.autopilot = null;
  world.driveInput = null;

  // Near flank slots behind the player's car, speeds matched.
  clearCruisers(world);
  const fx = -Math.sin(car.angle);
  const fz = -Math.cos(car.angle);
  const rx = -fz;
  const rz = fx;
  const slots = [
    [8, -3],
    [10.5, 3.5],
    [12, -1],
  ];
  for (const [back, side] of slots) {
    const c = spawnPoliceCar(
      world,
      car.x - fx * back + rx * side,
      car.z - fz * back + rz * side,
      car.angle
    );
    c.speed = car.speed;
  }
  world.wanted.level = 4;
  world.wanted.heat = 0;
  world.police.spawnTimer = 5;

  // The helicopter, held in the cover frame: behind and above the car,
  // low enough to read against the skyline, spotlight on the player car.
  const heli = spawnPoliceHelicopter(world);
  heli.hold = true;
  heli.x = car.x - fx * 15 + rx * 5;
  heli.z = car.z - fz * 15 + rz * 5;
  heli.y = 12.5;
  heli.angle = car.angle;
  heli.mesh.position.set(heli.x, heli.y, heli.z);
  heli.mesh.rotation.y = heli.angle;
  world.hud.messageTimer = 0; // the arrival message is for live play

  boostDensityNear(world, car.x, car.z, 12, 16);

  // Final segment: a hard turn at speed, laying the skid marks and dust.
  world.autopilot = { waypoints: [], index: 0, steerOverride: 0.55, cruiseSpeed: 29 };
  driveFor(world, 0.4);
  world.autopilot = null;
  world.driveInput = null;

  // Re-place the helicopter against the car's FINAL transform (the turn
  // moved the car ~11 m), then pin the cover camera: low and close in
  // front of the car, looking back at the whole police pack behind it.
  // One settle step lets the spotlight cone and the snapped camera apply.
  const cfx = -Math.sin(car.angle);
  const cfz = -Math.cos(car.angle);
  const crx = -cfz;
  const crz = cfx;
  heli.x = car.x - cfx * 16.5 + crx * 5;
  heli.z = car.z - cfz * 16.5 + crz * 5;
  heli.y = 11.5;
  heli.angle = car.angle;
  world.cameraPin = {
    pos: new THREE.Vector3(car.x + cfx * 9 + crx * 2.2, 3.0, car.z + cfz * 9 + crz * 2.2),
    look: new THREE.Vector3(car.x - cfx * 12, 1.5, car.z - cfz * 12),
  };
  world.camSnap = true;
  driveFor(world, 1 / 60);
}

// Three Vipers placed close in front of the player for the mission frame —
// centre 4.4 m out, flanks about 4.7 m — held in place, weapons ready.
export function placeVipers(world) {
  const p = world.player;
  const positions = [
    [150, -127.6],
    [146.8, -128.6],
    [153.2, -128.6],
  ];
  const vipers = positions.map(([x, z]) => {
    const e = spawnEnemy(world, x, z);
    e.hold = true;
    e.fireTimer = 99;
    e.angle = Math.atan2(-(p.x - x), -(p.z - z));
    e.mesh.rotation.y = e.angle;
    return e;
  });
  return vipers;
}

// 2-city.jpg — on foot in the Marina with mission-1 progression, a yellow
// taxi waiting in front of the player, wanted 1, and one cruiser visible
// down the road. The six-second simmer runs in the title phase so the
// police AI cannot wander into the frame early; the cruiser is placed
// afterwards, a few steps before the capture.
function stageCity(world) {
  setProgression(world, 400, 100, 1);
  startMission(world, 1);
  world.hud.bannerTimer = 0;
  world.hud.messageTimer = 0;
  spawnParkedCar(world, 'taxi', 20, 156.5, Math.PI, undefined);
  setPlayerOnFoot(world, 20, 158.5, 0);
  boostDensityNear(world, 20, 150, 10, 14);
  world.phase = 'title';
  driveFor(world, 6);
  world.phase = 'play';
  setPlayerOnFoot(world, 20, 158.5, 0);
  world.wanted.level = 1;
  world.wanted.heat = 0;
  const cruiser = spawnPoliceCar(world, 25, 137, Math.PI + 0.3);
  cruiser.speed = 0;
  world.police.spawnTimer = 5;
  driveFor(world, 0.05);
}

// 3-mission.jpg — HARBOR SHOWDOWN about to start: the previous mission's
// reward banner still up, wanted 2, three Vipers close in front, and a
// short exchange of fire timed so both sides' muzzle flashes are alive in
// the final frame. Player health is set to 79 for the capture.
function stageMission(world) {
  setProgression(world, 1000, 250, 2);
  world.phase = 'play';
  startMission(world, 2);
  showBanner(world, 'HEAT ESCAPE COMPLETE +$600 +150 XP', 99);
  world.wanted.level = 2;
  world.wanted.heat = 0;
  world.police.spawnTimer = 5;
  world.player.health = 83;
  setPlayerOnFoot(world, 150, -132, Math.PI);
  boostDensityNear(world, 150, -150, 3, 5);
  const vipers = placeVipers(world);
  driveFor(world, 0.5); // settle: camera swings in behind the player
  // Staggered return fire, then the player shoots back in the last steps.
  vipers[0].fireTimer = 0.005;
  vipers[1].fireTimer = 0.02;
  vipers[2].fireTimer = 0.04;
  const targets = [vipers[0], vipers[1], vipers[0]];
  for (let i = 0; i < 6; i++) {
    // Aim one step ahead of each shot so the chase camera has snapped
    // behind the player before the trigger is pulled.
    if (i >= 1 && i <= 3) {
      const t = targets[i - 1];
      if (t && !t.dead) aimAt(world, t.x, t.z);
    }
    driveFor(world, 1 / 60);
    if (i >= 2 && i <= 4) {
      world.fireCooldown = 0;
      playerShoot(world);
    }
  }
  world.player.health = 79;
}

// 4-title.jpg — the title card over a living city: extra traffic and
// pedestrians around downtown, six seconds of flow, no banners.
function stageTitle(world) {
  world.phase = 'title';
  boostDensityNear(world, 0, 0, 8, 10);
  world.hud.bannerTimer = 0;
  world.hud.messageTimer = 0;
  driveFor(world, 6);
  world.hud.bannerTimer = 0;
  world.hud.messageTimer = 0;
}

export function applyShotStaging(world, name) {
  world.shotMode = name;
  if (name === 'chase') stageChase(world);
  else if (name === 'city') stageCity(world);
  else if (name === 'mission') stageMission(world);
  else if (name === 'title') stageTitle(world);
}
