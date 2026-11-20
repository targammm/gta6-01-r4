// player.js — Rico Vale on foot: movement, jumping, building collision, driving and the chase camera.
import * as THREE from 'three';
import { PLAYER, PALETTE } from './config.js';
import { clamp, damp, angleDiff } from './random.js';
import { pointInBuilding, clampToCity } from './city.js';
import { driveCar } from './vehicles.js';
import { burstDust } from './effects.js';

export function createPlayer(state) {
  const group = new THREE.Group();
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.62, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x27364f })
  );
  legs.position.y = 0.31;
  group.add(legs);
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.62, 3, 8),
    new THREE.MeshLambertMaterial({ color: PALETTE.playerJacket })
  );
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b98d })
  );
  head.position.y = 1.74;
  group.add(head);
  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.3, 0.18, 10),
    new THREE.MeshLambertMaterial({ color: PALETTE.playerHat })
  );
  hat.position.y = 1.92;
  group.add(hat);
  group.position.set(PLAYER.spawnX, 0, PLAYER.spawnZ);
  state.render.scene.add(group);
  const player = {
    mesh: group, x: PLAYER.spawnX, y: 0, z: PLAYER.spawnZ,
    vx: 0, vz: 0, vy: 0, heading: PLAYER.spawnHeading,
    health: PLAYER.maxHealth, inCar: null, walkPhase: 0, onGround: true,
  };
  return player;
}

export function updatePlayer(state, dt) {
  const p = state.player;
  const input = state.input;
  const axes = state.moveAxes;
  const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const camYaw = state.camYaw;
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  const wx = (axes.strafe * cos - axes.forward * sin);
  const wz = (axes.strafe * -sin - axes.forward * cos);
  const len = Math.hypot(wx, wz) || 1;
  const tx = axes.forward || axes.strafe ? (wx / len) * speed : 0;
  const tz = axes.forward || axes.strafe ? (wz / len) * speed : 0;
  p.vx = damp(p.vx, tx, PLAYER.accelDamp, dt);
  p.vz = damp(p.vz, tz, PLAYER.accelDamp, dt);
  p.x += p.vx * dt;
  p.z += p.vz * dt;

  if ((axes.forward || axes.strafe)) {
    const targetHeading = Math.atan2(-p.vx, -p.vz);
    p.heading += angleDiff(p.heading, targetHeading) * Math.min(1, dt * 14);
    p.walkPhase += dt * (run ? 11 : 8);
    if (state.rng.chance(0.03)) {
      burstDust(state.effects, state.rng, p.x, 0.15, p.z, 1);
    }
  }
  if (input.keys.has('Space') && p.onGround) {
    p.vy = PLAYER.jumpSpeed;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= PLAYER.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }
  const hit = pointInBuilding(state.city, p.x, p.z, PLAYER.radius);
  if (hit) {
    const dxl = p.x - (hit.x - hit.hw - PLAYER.radius);
    const dxr = (hit.x + hit.hw + PLAYER.radius) - p.x;
    const dzl = p.z - (hit.z - hit.hd - PLAYER.radius);
    const dzr = (hit.z + hit.hd + PLAYER.radius) - p.z;
    const min = Math.min(dxl, dxr, dzl, dzr);
    if (min === dxl) p.x = hit.x - hit.hw - PLAYER.radius;
    else if (min === dxr) p.x = hit.x + hit.hw + PLAYER.radius;
    else if (min === dzl) p.z = hit.z - hit.hd - PLAYER.radius;
    else p.z = hit.z + hit.hd + PLAYER.radius;
    p.vx *= 0.4;
    p.vz *= 0.4;
  }
  const pos = { x: p.x, z: p.z };
  clampToCity(pos, 2);
  p.x = pos.x;
  p.z = pos.z;
  if (state.wanted.level < 1 && p.health > 0 && p.health < PLAYER.maxHealth) {
    p.health = Math.min(PLAYER.maxHealth, p.health + 2 * dt);
  }
  p.mesh.position.set(p.x, p.y + Math.abs(Math.sin(p.walkPhase)) * 0.06, p.z);
  p.mesh.rotation.y = p.heading;
}

export function updateDriving(state, dt) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  const axes = state.driveAxes;
  driveCar(state, car, axes.throttle, axes.steer, axes.brake, dt);
  p.x = car.x;
  p.z = car.z;
  p.heading = car.angle;
}

export function updateCamera(state, dt) {
  const cam = state.render.camera;
  const p = state.player;
  if (state.phase === 'title') {
    const t = state.elapsed * (Math.PI * 2 / 126);
    cam.position.set(Math.cos(t) * 130, 72, Math.sin(t) * 130);
    cam.lookAt(0, 10, 0);
    return;
  }
  state.camYaw += state.input.mouseDX * 0.0032;
  state.camPitch = clamp(state.camPitch + state.input.mouseDY * 0.0022, -0.15, 0.9);
  if (p.inCar) {
    const targetYaw = p.inCar.angle + state.input.mouseDX * 0; // mouse nudges handled below
    let diff = angleDiff(state.camYaw, p.inCar.angle);
    state.camYaw -= diff * Math.min(1, dt * 2.2) * (1 - 0.12);
    state.camYaw += state.input.mouseDX * 0.0032 * 0.12;
    void targetYaw;
  }
  const dist = p.inCar ? 9.5 : 7.5;
  const height = (p.inCar ? 4.2 : 3.4) + state.camPitch * 4;
  const fx = -Math.sin(state.camYaw);
  const fz = -Math.cos(state.camYaw);
  const anchorX = p.inCar ? p.inCar.x : p.x;
  const anchorZ = p.inCar ? p.inCar.z : p.z;
  const wantX = anchorX - fx * dist;
  const wantZ = anchorZ - fz * dist;
  const wantY = height;
  const k = 1 - Math.exp(-7 * dt);
  if (!state.camInit) {
    cam.position.set(wantX, wantY, wantZ);
    state.camInit = true;
  } else {
    cam.position.x += (wantX - cam.position.x) * k;
    cam.position.y += (wantY - cam.position.y) * k;
    cam.position.z += (wantZ - cam.position.z) * k;
  }
  if (state.camShake > 0) {
    state.camShake = Math.max(0, state.camShake - 1.8 * dt);
    cam.position.x += (state.rng.next() - 0.5) * state.camShake;
    cam.position.y += (state.rng.next() - 0.5) * state.camShake * 0.6;
  }
  const lookAhead = p.inCar ? 8 : 4;
  cam.lookAt(anchorX + fx * lookAhead, 1.7, anchorZ + fz * lookAhead);
}
