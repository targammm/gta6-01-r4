// player.js — Rico Vale on foot (walk, sprint, jump, building collision,
// health regen), the driving seat (delegating to vehicles.js), and the
// chase camera for both, plus the slow title orbit. The model's front is
// -Z, so mesh.rotation.y equals the heading directly.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp, damp, angleDamp } from './random.js';
import { readMoveAxes, driveAxes } from './input.js';
import { pointInBuilding, clampToCity } from './city.js';
import { driveCar } from './vehicles.js';
import { burstDust } from './effects.js';

function buildPlayerMesh() {
  const g = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0x27324e });
  const jacketMat = new THREE.MeshLambertMaterial({ color: 0x0f766e });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xe8b08a });
  const capMat = new THREE.MeshLambertMaterial({ color: 0xffc61a });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.24), legMat);
    leg.position.set(s * 0.14, 0.39, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.62, 4, 10), jacketMat);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skinMat);
  head.position.y = 1.86;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.13, 12), capMat);
  cap.position.y = 2.06;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), capMat);
  brim.position.set(0, 2.0, -0.32);
  g.add(brim);
  return g;
}

export function createPlayer(world) {
  const mesh = buildPlayerMesh();
  mesh.position.set(PLAYER.spawn.x, 0, PLAYER.spawn.z);
  world.render.scene.add(mesh);
  return {
    x: PLAYER.spawn.x,
    z: PLAYER.spawn.z,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    heading: PLAYER.spawn.heading,
    health: PLAYER.maxHealth,
    inCar: null,
    mesh,
    walkPhase: 0,
    grounded: true,
  };
}

// Push the player out of a building footprint along the shallowest axis.
function resolveBuilding(world, p) {
  const b = pointInBuilding(world.city, p.x, p.z, PLAYER.radius);
  if (!b) return;
  const dxl = p.x - (b.minX - PLAYER.radius);
  const dxr = b.maxX + PLAYER.radius - p.x;
  const dzl = p.z - (b.minZ - PLAYER.radius);
  const dzr = b.maxZ + PLAYER.radius - p.z;
  const m = Math.min(dxl, dxr, dzl, dzr);
  if (m === dxl) {
    p.x = b.minX - PLAYER.radius;
    p.vx *= 0.4;
  } else if (m === dxr) {
    p.x = b.maxX + PLAYER.radius;
    p.vx *= 0.4;
  } else if (m === dzl) {
    p.z = b.minZ - PLAYER.radius;
    p.vz *= 0.4;
  } else {
    p.z = b.maxZ + PLAYER.radius;
    p.vz *= 0.4;
  }
}

export function updatePlayer(world, dt) {
  const p = world.player;
  const input = world.input;
  world.camYaw -= input.yawDelta * 0.0032;
  world.camPitch = clamp(world.camPitch + input.pitchDelta * 0.0022, -0.15, 0.9);

  const axes = readMoveAxes(input);
  const fwdX = -Math.sin(world.camYaw);
  const fwdZ = -Math.cos(world.camYaw);
  const rightX = -fwdZ;
  const rightZ = fwdX;
  let wx = fwdX * axes.forward + rightX * axes.strafe;
  let wz = fwdZ * axes.forward + rightZ * axes.strafe;
  const len = Math.hypot(wx, wz);
  if (len > 1) {
    wx /= len;
    wz /= len;
  }
  const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const targetSpeed = len > 0 ? (running ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
  p.vx = damp(p.vx, wx * targetSpeed, 12, dt);
  p.vz = damp(p.vz, wz * targetSpeed, 12, dt);
  p.x += p.vx * dt;
  p.z += p.vz * dt;

  const speed2d = Math.hypot(p.vx, p.vz);
  if (speed2d > 0.6) {
    const targetHeading = Math.atan2(-p.vx, -p.vz);
    p.heading = angleDamp(p.heading, targetHeading, 14, dt);
    p.walkPhase += speed2d * dt * 1.7;
    if (world.rng.chance(0.05)) burstDust(world, p.x, 0.08, p.z, 1, 0.5);
  }

  if ((input.pressed.has('Space')) && p.grounded) {
    p.vy = PLAYER.jumpSpeed;
    p.grounded = false;
  }
  p.vy -= PLAYER.gravity * dt;
  p.y += p.vy * dt;
  if (p.y <= 0) {
    p.y = 0;
    p.vy = 0;
    p.grounded = true;
  }

  resolveBuilding(world, p);
  clampToCity(p, 2);

  if (world.wanted.level < 1 && p.health > 0 && p.health < PLAYER.maxHealth) {
    p.health = Math.min(PLAYER.maxHealth, p.health + 2 * dt);
  }

  const bob = Math.abs(Math.sin(p.walkPhase)) * 0.06;
  p.mesh.position.set(p.x, p.y + bob, p.z);
  p.mesh.rotation.y = p.heading;
}

export function updateDriving(world, dt) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  world.camYaw -= world.input.yawDelta * 0.0032 * 0.12;
  const axes = world.driveInput || driveAxes(world.input);
  driveCar(world, car, axes.throttle, axes.steer, axes.brake, dt);
  p.x = car.x;
  p.z = car.z;
  p.heading = car.angle;
}

// The chase camera: smoothed position and look target behind the player or
// the car, mouse pitch lifting the camera, impact shake on top. A pinned
// camera (screenshot staging) wins over everything.
export function updateCamera(world, dt) {
  const cam = world.render.camera;
  if (world.cameraPin) {
    cam.position.copy(world.cameraPin.pos);
    cam.lookAt(world.cameraPin.look);
    return;
  }
  if (world.phase === 'title') {
    world.titleT += dt;
    const a = 2.2 + world.titleT * ((Math.PI * 2) / 126);
    cam.position.set(Math.sin(a) * 130, 72, Math.cos(a) * 130);
    cam.lookAt(0, 10, 0);
    return;
  }
  const p = world.player;
  const driving = !!p.inCar;
  if (driving) {
    world.camYaw = angleDamp(world.camYaw, p.inCar.angle + world.driveCamOffset, 3.5, dt);
    world.driveCamOffset = damp(world.driveCamOffset, 0, 1.5, dt);
  }
  const dist = driving ? 9.5 : 7.5;
  const height = (driving ? 4.2 : 3.4) + world.camPitch * 4;
  const fx = -Math.sin(world.camYaw);
  const fz = -Math.cos(world.camYaw);
  const tx = driving ? p.inCar.x : p.x;
  const tz = driving ? p.inCar.z : p.z;
  const desired = new THREE.Vector3(tx - fx * dist, height, tz - fz * dist);
  const lookDist = driving ? 8 : 4;
  const look = new THREE.Vector3(tx + fx * lookDist, 1.7, tz + fz * lookDist);
  if (world.camSnap || !world.camPos) {
    world.camPos = desired.clone();
    world.camLook = look.clone();
    world.camSnap = false;
  } else {
    const k = 1 - Math.exp(-7 * dt);
    world.camPos.lerp(desired, k);
    world.camLook.lerp(look, k);
  }
  cam.position.copy(world.camPos);
  if (world.shake > 0.003) {
    cam.position.x += world.rng.range(-1, 1) * world.shake * 0.35;
    cam.position.y += world.rng.range(-1, 1) * world.shake * 0.25;
  }
  cam.lookAt(world.camLook);
}
