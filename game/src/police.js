// police.js — wanted level, cruiser pursuit, the busted rule, and the Solmar Bay PD helicopter.
import * as THREE from 'three';
import { WANTED, MAX_POLICE } from './config.js';
import { clamp, dist2D, angleDiff } from './random.js';
import { pointInBuilding } from './city.js';
import { createCarMesh, syncCarMesh } from './vehicles.js';
import { addWanted } from './vehicles.js';

export function createPolice(state) {
  state.police = { cruisers: [], heli: null, spawnTimer: 0, bustTimer: 0, heliAnnounced: false };
  return state.police;
}

export function spawnPoliceCar(state, mode) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const pz = p.inCar ? p.inCar.z : p.z;
  const mesh = createCarMesh('cruiser', 0xffffff);
  state.render.scene.add(mesh);
  let x;
  let z;
  let angle;
  if (mode === 'front') {
    const fx = -Math.sin(p.heading);
    const fz = -Math.cos(p.heading);
    x = px + fx * 24 - fz * 4;
    z = pz + fz * 24 + fx * 4;
    angle = p.heading + Math.PI;
  } else if (mode === 'side') {
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    x = px + rx * 5 - (-Math.sin(p.heading)) * -4;
    z = pz + rz * 5 - (-Math.cos(p.heading)) * -4;
    angle = p.heading;
  } else {
    const a = state.rng.range(0, Math.PI * 2);
    const d = state.rng.range(55, 80);
    x = clamp(px + Math.cos(a) * d, -200, 200);
    z = clamp(pz + Math.sin(a) * d, -200, 200);
    angle = Math.atan2(-(px - x), -(pz - z));
  }
  const car = {
    kind: 'cruiser', mesh, x, z, angle, speed: 0, color: 0xffffff,
    driver: 'police', ai: null, wheels: mesh.userData.wheels,
    lightBar: mesh.userData.lightBar, flashPhase: state.rng.range(0, 2), ramCooldown: 0,
  };
  syncCarMesh(car);
  state.police.cruisers.push(car);
  return car;
}

export function desiredCruisers(wantedLevel) {
  if (wantedLevel < 1) return 0;
  return Math.min(MAX_POLICE, 1 + Math.floor(wantedLevel));
}

export function updateWantedLevel(state, dt) {
  const w = state.wanted;
  w.heat += dt;
  const heli = state.police ? state.police.heli : null;
  const heliWatching = !!(heli && heli.active);
  if (w.level > 0 && w.heat > WANTED.decayDelay && !heliWatching) {
    let nearest = Infinity;
    for (const c of state.police.cruisers) {
      nearest = Math.min(nearest, dist2D(c.x, c.z, state.player.x, state.player.z));
    }
    if (nearest > 70 || state.police.cruisers.length === 0) {
      w.level = Math.max(0, w.level - WANTED.decayRate * dt);
      if (w.level < 0.4 && w.level > 0) {
        w.level = 0;
        state.showMessage('You lost them', 3);
      }
    }
  }
  if (w.level < 3 && state.police) state.police.heliAnnounced = false;
}

// ---------------------------------------------------------------- helicopter
export function createPoliceHelicopter(state) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf4f6f8 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x15181d });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), bodyMat);
  body.scale.set(1, 0.82, 1.9);
  body.castShadow = true;
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.5, 3.4), trimMat);
  stripe.position.y = -0.25;
  group.add(stripe);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.4, 4.6, 6), bodyMat);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.25, 3.9);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.7), trimMat);
  fin.position.set(0, 0.6, 6.1);
  group.add(fin);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x33383f });
  for (const sx of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3), skidMat);
    skid.position.set(sx * 1.05, -1.25, 0);
    group.add(skid);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), skidMat);
    strut.position.set(sx * 1.05, -0.85, 0.8);
    group.add(strut);
  }
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x22262c }));
  rotor.position.y = 1.45;
  group.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x22262c }));
  tailRotor.position.set(0.25, 0.6, 6.1);
  group.add(tailRotor);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  beacon.position.set(0, -0.6, 5.9);
  group.add(beacon);
  const spotGeo = new THREE.ConeGeometry(4.5, 30, 12, 1, true);
  const spotMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.16,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const spot = new THREE.Mesh(spotGeo, spotMat);
  spot.position.y = -15.8;
  group.add(spot);
  const spotLight = new THREE.SpotLight(0xfff2b0, 350, 70, 0.32, 0.5, 1.2);
  group.add(spotLight);
  spotLight.position.set(0, -1, 0);
  group.add(spotLight.target);
  state.render.scene.add(group);
  group.visible = false;
  return {
    mesh: group, rotor, tailRotor, beacon, spot, spotLight,
    active: false, x: 0, y: 60, z: 0, angle: 0, bobPhase: 0, beaconPhase: 0,
  };
}

export function spawnPoliceHelicopter(state) {
  const police = state.police;
  if (!police.heli) police.heli = createPoliceHelicopter(state);
  const heli = police.heli;
  if (heli.active) return heli;
  const p = state.player;
  heli.active = true;
  heli.x = p.x + 60;
  heli.z = p.z - 60;
  heli.y = 46;
  heli.mesh.visible = true;
  if (!police.heliAnnounced) {
    police.heliAnnounced = true;
    state.showMessage('Helicopter overhead — break line of sight!', 4);
  }
  return heli;
}

export function despawnPoliceHelicopter(state) {
  const heli = state.police.heli;
  if (!heli) return;
  heli.active = false;
  heli.mesh.visible = false;
}

export function updatePoliceHelicopter(state, dt) {
  const police = state.police;
  const level = Math.floor(state.wanted.level);
  if (level >= 4 && !state.shotMode) spawnPoliceHelicopter(state);
  if (level >= 4 && state.shotMode && !police.heli) {
    police.heli = createPoliceHelicopter(state);
  }
  const heli = police.heli;
  if (!heli || !heli.active) return;
  if (state.wanted.level < 3) {
    despawnPoliceHelicopter(state);
    return;
  }
  const p = state.player;
  const tx = p.inCar ? p.inCar.x : p.x;
  const tz = p.inCar ? p.inCar.z : p.z;
  const hoverAlt = heli.hoverAlt || 28;
  const back = 9;
  const targetX = tx + Math.sin(p.heading) * back;
  const targetZ = tz + Math.cos(p.heading) * back;
  const k = Math.min(1, dt * 1.6);
  heli.x += (targetX - heli.x) * k;
  heli.z += (targetZ - heli.z) * k;
  heli.bobPhase += dt * 2;
  heli.y += ((hoverAlt + Math.sin(heli.bobPhase) * 1.2) - heli.y) * Math.min(1, dt * 2);
  heli.angle = Math.atan2(-(tx - heli.x), -(tz - heli.z));
  heli.rotor.rotation.y += dt * 28;
  heli.tailRotor.rotation.x += dt * 32;
  heli.beaconPhase += dt * 5;
  heli.beacon.material.color.setHex(Math.sin(heli.beaconPhase) > 0 ? 0xff2a2a : 0x551111);
  heli.mesh.position.set(heli.x, heli.y, heli.z);
  heli.mesh.rotation.y = heli.angle;
  // Spotlight cone + light track the player on the ground.
  heli.spotLight.target.position.set(tx - heli.x, -heli.y, tz - heli.z);
  const tiltX = clamp((tx - heli.x) / 30, -0.4, 0.4);
  const tiltZ = clamp((tz - heli.z) / 30, -0.4, 0.4);
  heli.spot.rotation.x = tiltZ;
  heli.spot.rotation.z = -tiltX;
}

export function updatePoliceChase(state, dt) {
  const police = state.police;
  const w = state.wanted;
  const level = Math.floor(w.level);
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const pz = p.inCar ? p.inCar.z : p.z;

  police.spawnTimer -= dt;
  const want = desiredCruisers(w.level);
  if (police.cruisers.length < want && police.spawnTimer <= 0) {
    spawnPoliceCar(state);
    police.spawnTimer = WANTED.spawnDelays[Math.min(level, 5)] || 5;
  }
  if (w.level <= 0 && police.cruisers.length > 0) {
    const far = police.cruisers[police.cruisers.length - 1];
    state.render.scene.remove(far.mesh);
    police.cruisers.pop();
  }

  const targetSpeed = WANTED.policeSpeeds[Math.min(level, 5)] || 22;
  for (const car of police.cruisers) {
    if (car.driver === 'player') continue;
    const desired = Math.atan2(-(px - car.x), -(pz - car.z));
    const diff = angleDiff(car.angle, desired);
    const turn = clamp(diff, -2.2 * dt, 2.2 * dt);
    car.angle += turn;
    const d = dist2D(car.x, car.z, px, pz);
    const speedGoal = d > 14 ? targetSpeed : targetSpeed * 0.55;
    car.speed += clamp(speedGoal - car.speed, -20 * dt, 12 * dt);
    car.x += -Math.sin(car.angle) * car.speed * dt;
    car.z += -Math.cos(car.angle) * car.speed * dt;
    if (pointInBuilding(state.city, car.x, car.z, 1.2)) {
      car.x -= -Math.sin(car.angle) * car.speed * dt;
      car.z -= -Math.cos(car.angle) * car.speed * dt;
      car.speed = -4;
      car.angle += 0.7 * dt * 3;
    }
    car.x = clamp(car.x, -206, 206);
    car.z = clamp(car.z, -206, 203);
    car.ramCooldown -= dt;
    if (d < 4 && car.ramCooldown <= 0) {
      car.ramCooldown = 1.2;
      state.camShake = Math.max(state.camShake, 0.35);
      if (p.inCar) {
        p.inCar.speed *= 1 - 0.35;
      } else if (state.rng.chance(0.5)) {
        p.health = Math.max(1, p.health - 1);
      }
    }
    syncCarMesh(car);
  }

  // Busted: a cruiser pinning an on-foot player for 2.5 s ends the chase.
  if (!p.inCar && w.level >= 1 && state.phase === 'play') {
    let pinned = false;
    for (const car of police.cruisers) {
      if (dist2D(car.x, car.z, p.x, p.z) < 3) pinned = true;
    }
    if (pinned) {
      police.bustTimer += dt;
      if (police.bustTimer >= 2.5) {
        police.bustTimer = 0;
        state.phase = 'busted';
      }
    } else {
      police.bustTimer = 0;
    }
  }
  updatePoliceHelicopter(state, dt);
}

export { addWanted };
