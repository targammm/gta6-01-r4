// missions.js — the chained three-mission story: PACKAGE RUN, HEAT ESCAPE
// and HARBOR SHOWDOWN. Steps are goto / escape / fight; a pulsing beacon
// marks goto targets, completion pays out, banners announce, and the next
// mission starts immediately.

import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { spawnEnemy } from './combat.js';
import { showBanner, showMessage } from './hud.js';
import { writeSave } from './save.js';
import { playMissionComplete } from './audio.js';

export function createMissions(world) {
  return {
    index: 0,
    step: 0,
    active: null,
    beacon: null,
    beaconRing: null,
    target: null,
    enemies: [],
    started: false,
  };
}

export function placeMissionBeacon(world, x, z) {
  const m = world.missions;
  if (!m.beacon) {
    const group = new THREE.Group();
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd83d, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
    );
    column.position.y = 30;
    group.add(column);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.4, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd83d, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
    m.beacon = group;
    m.beaconRing = ring;
    world.render.scene.add(group);
  }
  m.beacon.position.set(x, 0, z);
  m.beacon.visible = true;
}

export function removeMissionBeacon(world) {
  const m = world.missions;
  if (m.beacon) m.beacon.visible = false;
  m.target = null;
}

export function currentObjective(world) {
  const m = world.missions;
  if (!m.active) return 'Free roam — Rico Vale owns Solmar Bay.';
  const step = m.active.steps[m.step];
  return step ? `${m.active.name}: ${step.label}` : m.active.name;
}

export function missionTargetPos(world) {
  const m = world.missions;
  if (!m.active) return null;
  const step = m.active.steps[m.step];
  if (!step) return null;
  if (step.kind === 'goto' || step.kind === 'fight') return { x: step.x, z: step.z };
  return null;
}

export function startMission(world, idx) {
  const m = world.missions;
  m.index = idx;
  m.step = 0;
  m.enemies = [];
  m.active = MISSIONS[idx] || null;
  m.started = true;
  if (!m.active) {
    removeMissionBeacon(world);
    world.objectiveText = currentObjective(world);
    return;
  }
  if (idx === 1) {
    // HEAT ESCAPE opens under full police attention.
    world.wanted.level = 3;
    world.wanted.heat = 0;
  }
  showBanner(world, m.active.name, 5);
  showMessage(world, m.active.story, 4);
  applyStep(world);
  world.objectiveText = currentObjective(world);
}

// Set up whatever the current step needs: a beacon for goto, enemies for a
// fight, nothing for an escape.
function applyStep(world) {
  const m = world.missions;
  const step = m.active?.steps[m.step];
  if (!step) return;
  if (step.kind === 'goto') {
    placeMissionBeacon(world, step.x, step.z);
    m.target = { x: step.x, z: step.z };
  } else if (step.kind === 'fight') {
    removeMissionBeacon(world);
    m.target = { x: step.x, z: step.z };
    spawnMissionEnemies(world);
  } else {
    removeMissionBeacon(world);
  }
}

export function spawnMissionEnemies(world) {
  const m = world.missions;
  const step = m.active?.steps[m.step];
  const cx = step?.x ?? 150;
  const cz = step?.z ?? -150;
  const offsets = [
    [-8, -6],
    [7, -9],
    [2, 8],
  ];
  m.enemies = offsets.map(([dx, dz]) => spawnEnemy(world, cx + dx, cz + dz));
  return m.enemies;
}

export function advanceMissionStep(world) {
  const m = world.missions;
  if (!m.active) return;
  m.step++;
  if (m.step >= m.active.steps.length) {
    completeMission(world);
    return;
  }
  applyStep(world);
  world.objectiveText = currentObjective(world);
  const step = m.active.steps[m.step];
  showMessage(world, step.label, 3.5);
}

export function completeMission(world) {
  const m = world.missions;
  const done = m.active;
  if (!done) return;
  world.money += done.reward;
  world.xp += done.xp;
  world.missionsDone = m.index + 1;
  removeMissionBeacon(world);
  playMissionComplete(world);
  writeSave(world);
  const next = m.index + 1;
  if (next < MISSIONS.length) {
    showBanner(world, `${done.name} COMPLETE +$${done.reward} +${done.xp} XP`, 5);
    startMission(world, next);
    // Keep the reward banner up over the new mission's intro banner.
    showBanner(world, `${done.name} COMPLETE +$${done.reward} +${done.xp} XP`, 5);
  } else {
    m.active = null;
    showBanner(world, 'STORY COMPLETE — Rico Vale owns Solmar Bay. Free roam!', 6);
    world.objectiveText = currentObjective(world);
  }
}

export function updateMissions(world, dt) {
  const m = world.missions;
  if (!m.active) return;
  if (m.beacon && m.beacon.visible && m.beaconRing) {
    const pulse = 1 + Math.sin(world.elapsed * 3) * 0.12;
    m.beaconRing.scale.set(pulse, pulse, 1);
    m.beaconRing.material.opacity = 0.28 + Math.sin(world.elapsed * 3) * 0.1;
  }
  const step = m.active.steps[m.step];
  if (!step) return;
  const p = world.player;
  if (step.kind === 'goto') {
    if (Math.hypot(p.x - step.x, p.z - step.z) < step.radius) {
      advanceMissionStep(world);
    }
  } else if (step.kind === 'escape') {
    if (world.wanted.level <= 0) {
      advanceMissionStep(world);
    }
  } else if (step.kind === 'fight') {
    if (m.enemies.length > 0 && m.enemies.every((e) => e.dead)) {
      m.enemies = [];
      advanceMissionStep(world);
    }
  }
  world.objectiveText = currentObjective(world);
}
