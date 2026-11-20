// police.js — the Solmar Bay PD: the wanted level and its decay, cruiser
// spawning and the chase AI (pursuit, ramming, busting), and the police
// helicopter that joins at wanted level 4–5, holds a spotlight on the
// player and stops the wanted level from decaying while it is overhead.

import * as THREE from 'three';
import { WANTED, MAX_POLICE } from './config.js';
import { clamp, damp, angleDamp, angleDiff } from './random.js';
import { createCarMesh, syncCarMesh, addWanted } from './vehicles.js';
import { pointInBuilding } from './city.js';
import { showMessage } from './hud.js';

export function createPolice(world) {
  const police = {
    cruisers: [],
    spawnTimer: 0.5,
    despawnTimer: 0,
    bustedTimer: 0,
    ramCooldown: 0,
    heli: null,
  };
  police.heli = createPoliceHelicopter(world);
  return police;
}

// The helicopter: a procedural airframe with spinning main and tail rotors,
// a blinking beacon, skids, a visible spotlight cone and a real spotlight
// that tracks the player. Built once, hidden until it is called in.
export function createPoliceHelicopter(world) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf2f4f6 });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0x2255aa });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2836 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 2.4, 4, 10), bodyMat);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.4, 2.6), stripeMat);
  stripe.position.set(0, -0.25, 0.2);
  g.add(stripe);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.82, 12, 10), darkMat);
  cockpit.position.set(0, 0.12, -1.55);
  cockpit.scale.set(0.95, 0.85, 0.9);
  g.add(cockpit);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 3.6), bodyMat);
  tail.position.set(0, 0.25, 3);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.7), stripeMat);
  fin.position.set(0, 0.7, 4.7);
  g.add(fin);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.2), darkMat);
  tailRotor.position.set(0.24, 0.7, 4.7);
  g.add(tailRotor);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), darkMat);
  mast.position.y = 1.05;
  g.add(mast);
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.05, 0.42), bladeMat);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 7.8), bladeMat);
  rotor.add(b1);
  rotor.add(b2);
  rotor.position.y = 1.32;
  g.add(rotor);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x555c63 });
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), skidMat);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(s * 0.8, -1.05, 0);
    g.add(skid);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), skidMat);
    strut.position.set(s * 0.8, -0.8, 0.9);
    g.add(strut);
    const strut2 = strut.clone();
    strut2.position.z = -0.9;
    g.add(strut2);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  beacon.position.set(0, 0.75, 1.6);
  g.add(beacon);

  // The spotlight beam: a translucent cone plus a real spotlight.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c0,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 30, 20, 1, true), coneMat);
  cone.visible = false;
  world.render.scene.add(cone);
  const spot = new THREE.SpotLight(0xfff2c0, 0, 110, 0.36, 0.55, 0.6);
  world.render.scene.add(spot);
  world.render.scene.add(spot.target);

  g.visible = false;
  world.render.scene.add(g);
  return {
    mesh: g,
    rotor,
    tailRotor,
    beacon,
    cone,
    spot,
    active: false,
    hold: false,
    x: 0,
    y: 60,
    z: 0,
    angle: 0,
  };
}

export function spawnPoliceHelicopter(world) {
  const heli = world.police.heli;
  if (heli.active) return heli;
  const t = world.player.inCar || world.player;
  heli.active = true;
  heli.hold = false;
  heli.x = t.x + 14;
  heli.y = 30;
  heli.z = t.z + 14;
  heli.mesh.visible = true;
  heli.cone.visible = true;
  heli.mesh.position.set(heli.x, heli.y, heli.z);
  showMessage(world, 'Police helicopter overhead — break line of sight!');
  return heli;
}

function despawnPoliceHelicopter(world) {
  const heli = world.police.heli;
  heli.active = false;
  heli.mesh.visible = false;
  heli.cone.visible = false;
  heli.spot.intensity = 0;
  world.wanted.decayBlocked = false;
}

export function updatePoliceHelicopter(world, dt) {
  const heli = world.police.heli;
  const level = world.wanted.level;
  if (!heli.active && level >= 4) spawnPoliceHelicopter(world);
  if (!heli.active) return;
  if (level < 3) {
    despawnPoliceHelicopter(world);
    return;
  }
  const t = world.player.inCar || world.player;
  heli.rotor.rotation.y += dt * 38;
  heli.tailRotor.rotation.x += dt * 46;
  heli.beacon.visible = Math.sin(world.elapsed * 7) > -0.2;

  if (!heli.hold) {
    const fx = t === world.player ? -Math.sin(world.player.heading) : -Math.sin(t.angle);
    const fz = t === world.player ? -Math.cos(world.player.heading) : -Math.cos(t.angle);
    heli.x = damp(heli.x, t.x - fx * 10, 1.6, dt);
    heli.z = damp(heli.z, t.z - fz * 10, 1.6, dt);
    heli.y = damp(heli.y, 28, 0.9, dt);
    heli.angle = angleDamp(heli.angle, Math.atan2(-(t.x - heli.x), -(t.z - heli.z)), 3, dt);
  }
  heli.mesh.position.set(heli.x, heli.y, heli.z);
  heli.mesh.rotation.y = heli.angle;

  // Aim the beam and the real spotlight at the target.
  heli.spot.position.set(heli.x, heli.y, heli.z);
  heli.spot.target.position.set(t.x, 0, t.z);
  heli.spot.target.updateMatrixWorld();
  heli.spot.intensity = 900;
  const dx = heli.x - t.x;
  const dy = heli.y;
  const dz = heli.z - t.z;
  const dist = Math.hypot(dx, dy, dz) || 1;
  const cone = heli.cone;
  cone.position.set((heli.x + t.x) / 2, heli.y / 2, (heli.z + t.z) / 2);
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3(dx / dist, dy / dist, dz / dist);
  cone.quaternion.setFromUnitVectors(up, dir);
  const s = dist / 30;
  cone.scale.set(s, s, s);

  // While it is overhead it keeps eyes on you: no wanted decay.
  world.wanted.decayBlocked = Math.hypot(heli.x - t.x, heli.z - t.z) < 45;
}

export function spawnPoliceCar(world, x, z, angle) {
  const mesh = createCarMesh('cruiser', 0xf2f4f6);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  world.render.scene.add(mesh);
  const car = {
    id: world.nextCarId++,
    kind: 'cruiser',
    isPolice: true,
    x,
    z,
    angle,
    targetAngle: angle,
    speed: 0,
    mesh,
    driver: 'police',
    stolen: false,
    parked: false,
    cruise: 0,
    avoidTimer: 0,
  };
  world.cars.push(car);
  world.police.cruisers.push(car);
  return car;
}

function removeCruiser(world, car) {
  world.render.scene.remove(car.mesh);
  world.police.cruisers.splice(world.police.cruisers.indexOf(car), 1);
  const ci = world.cars.indexOf(car);
  if (ci >= 0) world.cars.splice(ci, 1);
}

export function clearPolice(world) {
  for (const car of [...world.police.cruisers]) removeCruiser(world, car);
  if (world.police.heli.active) despawnPoliceHelicopter(world);
  world.police.bustedTimer = 0;
}

export function updateWantedLevel(world, dt) {
  const w = world.wanted;
  const police = world.police;
  w.heat += dt;

  const targetCount = w.level >= 1 ? Math.min(MAX_POLICE, 1 + Math.floor(w.level)) : 0;
  if (police.cruisers.length < targetCount) {
    police.spawnTimer -= dt;
    if (police.spawnTimer <= 0) {
      // Spawn on a ring 55–80 m out, on open ground.
      const p = world.player;
      for (let tries = 0; tries < 6; tries++) {
        const a = world.rng.range(0, Math.PI * 2);
        const d = world.rng.range(55, 80);
        const x = clamp(p.x + Math.cos(a) * d, -200, 200);
        const z = clamp(p.z + Math.sin(a) * d, -200, 200);
        if (!pointInBuilding(world.city, x, z, 3)) {
          spawnPoliceCar(world, x, z, Math.atan2(-(p.x - x), -(p.z - z)));
          break;
        }
      }
      police.spawnTimer = WANTED.spawnDelay[Math.floor(clamp(w.level, 0, 5))] || 3;
    }
  } else if (targetCount === 0 && police.cruisers.length > 0) {
    police.despawnTimer -= dt;
    if (police.despawnTimer <= 0) {
      let far = null;
      let farD = -1;
      for (const c of police.cruisers) {
        const d = Math.hypot(c.x - world.player.x, c.z - world.player.z);
        if (d > farD) {
          farD = d;
          far = c;
        }
      }
      if (far) removeCruiser(world, far);
      police.despawnTimer = 0.8;
    }
  }

  // Decay: only after a calm stretch, with no cruiser close, and never
  // while the helicopter is watching.
  if (w.level > 0 && w.heat > WANTED.decayDelay && !w.decayBlocked) {
    let nearest = Infinity;
    for (const c of police.cruisers) {
      nearest = Math.min(nearest, Math.hypot(c.x - world.player.x, c.z - world.player.z));
    }
    if (nearest > 70 || police.cruisers.length === 0) {
      const before = w.level;
      w.level = Math.max(0, w.level - WANTED.decayRate * dt);
      if (before >= WANTED.decayFloor && w.level < WANTED.decayFloor) {
        w.level = 0;
        showMessage(world, 'You lost them');
      }
    }
  }
}

export function updatePoliceChase(world, dt) {
  const police = world.police;
  const p = world.player;
  const t = p.inCar || p;
  police.ramCooldown = Math.max(0, police.ramCooldown - dt);
  let anyClose = false;

  for (const car of police.cruisers) {
    const dx = t.x - car.x;
    const dz = t.z - car.z;
    const dist = Math.hypot(dx, dz);
    const desired = Math.atan2(-dx, -dz);
    const diff = angleDiff(car.angle, desired);
    const maxTurn = 2.2 * dt;
    car.angle += clamp(diff, -maxTurn, maxTurn);

    // Buildings: back off and swing around instead of grinding the wall.
    const fx = -Math.sin(car.angle);
    const fz = -Math.cos(car.angle);
    if (car.avoidTimer > 0) {
      car.avoidTimer -= dt;
      car.speed = -6;
    } else if (pointInBuilding(world.city, car.x + fx * 6, car.z + fz * 6, 1.6)) {
      car.avoidTimer = 0.5;
      car.speed = -6;
    } else {
      const targetSpeed = world.wanted.level > 0 ? WANTED.policeSpeed[Math.floor(clamp(world.wanted.level, 0, 5))] : 10;
      const delta = targetSpeed - car.speed;
      car.speed += clamp(delta, -18 * dt, 10 * dt);
    }
    const prevX = car.x;
    const prevZ = car.z;
    car.x += -Math.sin(car.angle) * car.speed * dt;
    car.z += -Math.cos(car.angle) * car.speed * dt;
    if (pointInBuilding(world.city, car.x, car.z, 1.3)) {
      car.x = prevX;
      car.z = prevZ;
      car.speed *= -0.3;
    }
    car.x = clamp(car.x, -208, 208);
    car.z = clamp(car.z, -208, 208);

    // Strobing light bar.
    const phase = Math.floor(world.elapsed * 3 + car.id) % 2;
    if (car.mesh.userData.barRed) car.mesh.userData.barRed.visible = phase === 0;
    if (car.mesh.userData.barBlue) car.mesh.userData.barBlue.visible = phase === 1;

    // Ramming the player's car; crowding a player on foot builds to a bust.
    if (dist < 4) {
      if (p.inCar) {
        p.inCar.speed *= 1 - 0.35 * dt;
        if (police.ramCooldown <= 0) {
          world.shake = Math.max(world.shake, 0.35);
          police.ramCooldown = 1.2;
          if (world.rng.chance(0.3)) p.health = Math.max(0, p.health - 1);
        }
      } else if (dist < 3) {
        anyClose = true;
      }
    }
    syncCarMesh(car, dt);
  }

  if (!p.inCar && anyClose) {
    police.bustedTimer += dt;
    if (police.bustedTimer >= 2.5 && world.phase === 'play') {
      world.phase = 'busted';
    }
  } else {
    police.bustedTimer = Math.max(0, police.bustedTimer - dt * 2);
  }

  updatePoliceHelicopter(world, dt);
}

export { addWanted };
