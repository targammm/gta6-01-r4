// missions.js — the three-mission story chain: beacons, objectives, rewards and Viper ambushes.
import * as THREE from 'three';
import { MISSIONS, PALETTE } from './config.js';
import { dist2D } from './random.js';
import { spawnEnemy } from './combat.js';

export function createMissions(state) {
  state.missions = {
    index: 0, step: 0, active: false, beacon: null, beaconRing: null,
    bannerTimer: 0, bannerText: '', fightSpawned: false,
  };
  return state.missions;
}

export function placeMissionBeacon(state, x, z) {
  removeMissionBeacon(state);
  const geo = new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: PALETTE.beacon, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(geo, mat);
  beacon.position.set(x, 30, z);
  state.render.scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.beacon, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.06, z);
  state.render.scene.add(ring);
  state.missions.beacon = beacon;
  state.missions.beaconRing = ring;
}

export function removeMissionBeacon(state) {
  const m = state.missions;
  if (m.beacon) {
    state.render.scene.remove(m.beacon);
    m.beacon = null;
  }
  if (m.beaconRing) {
    state.render.scene.remove(m.beaconRing);
    m.beaconRing = null;
  }
}

export function currentObjective(state) {
  const m = state.missions;
  if (!m.active) return '';
  const mission = MISSIONS[m.index];
  if (!mission) return 'Free roam — Solmar Bay is yours';
  const step = mission.steps[m.step];
  if (!step) return '';
  return mission.name + ': ' + step.text;
}

export function missionTargetPos(state) {
  const m = state.missions;
  if (!m.active) return null;
  const mission = MISSIONS[m.index];
  if (!mission) return null;
  const step = mission.steps[m.step];
  if (!step || step.kind === 'escape') return null;
  return { x: step.x, z: step.z };
}

export function startMission(state, index) {
  const m = state.missions;
  m.index = index;
  m.step = 0;
  m.fightSpawned = false;
  const mission = MISSIONS[index];
  if (!mission) {
    m.active = false;
    removeMissionBeacon(state);
    state.showBanner('STORY COMPLETE — Rico Vale owns Solmar Bay. Free roam!', 6);
    return;
  }
  m.active = true;
  state.showBanner(mission.name + ' — ' + mission.intro, 5);
  if (mission.name === 'HEAT ESCAPE') {
    state.wanted.level = Math.max(state.wanted.level, 3);
    state.wanted.heat = 0;
  }
  const step = mission.steps[0];
  if (step.kind === 'goto') placeMissionBeacon(state, step.x, step.z);
}

export function spawnMissionEnemies(state) {
  const spots = [[-8, -6], [7, -9], [2, 8]];
  const out = [];
  for (const [ox, oz] of spots) {
    out.push(spawnEnemy(state, 150 + ox, -150 + oz));
  }
  return out;
}

export function completeMission(state) {
  const m = state.missions;
  const mission = MISSIONS[m.index];
  if (!mission) return;
  state.money += mission.reward;
  state.xp += mission.xp;
  state.save.missionsDone = Math.max(state.save.missionsDone, m.index + 1);
  if (state.money > state.save.bestMoney) state.save.bestMoney = state.money;
  state.showBanner(mission.name + ' COMPLETE +$' + mission.reward + ' +' + mission.xp + ' XP', 5);
  if (state.audio) state.audioMissionComplete = true;
  state.persistSave();
  startMission(state, m.index + 1);
}

export function advanceMissionStep(state) {
  const m = state.missions;
  const mission = MISSIONS[m.index];
  if (!mission) return;
  m.step += 1;
  m.fightSpawned = false;
  if (m.step >= mission.steps.length) {
    removeMissionBeacon(state);
    completeMission(state);
    return;
  }
  const step = mission.steps[m.step];
  if (step.kind === 'goto') placeMissionBeacon(state, step.x, step.z);
  else removeMissionBeacon(state);
}

export function updateMissions(state, dt) {
  const m = state.missions;
  if (m.beaconRing) {
    const s = 1 + Math.sin(state.elapsed * 3) * 0.12;
    m.beaconRing.scale.set(s, s, 1);
    m.beaconRing.material.opacity = 0.28 + Math.sin(state.elapsed * 3) * 0.1;
  }
  if (!m.active || state.phase !== 'play') return;
  const mission = MISSIONS[m.index];
  if (!mission) return;
  const step = mission.steps[m.step];
  if (!step) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const pz = p.inCar ? p.inCar.z : p.z;
  if (step.kind === 'goto') {
    if (dist2D(px, pz, step.x, step.z) < step.radius) advanceMissionStep(state);
  } else if (step.kind === 'escape') {
    if (state.wanted.level <= 0) advanceMissionStep(state);
  } else if (step.kind === 'fight') {
    if (!m.fightSpawned) {
      m.fightSpawned = true;
      spawnMissionEnemies(state);
    }
    const alive = state.enemies.filter((e) => !e.dead).length;
    if (alive === 0 && m.fightSpawned) advanceMissionStep(state);
  }
}
