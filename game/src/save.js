// save.js — the localStorage save: money, XP, missions done, best money and
// total play time, under one versioned key.

import { SAVE_KEY, createDefaultSave } from './config.js';

export function hasSaveData() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultSave();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return createDefaultSave();
    return { ...createDefaultSave(), ...data };
  } catch {
    return createDefaultSave();
  }
}

export function writeSave(world) {
  if (!world.save) world.save = createDefaultSave();
  world.save.money = world.money;
  world.save.xp = world.xp;
  world.save.missionsDone = world.missionsDone;
  world.save.bestMoney = Math.max(world.save.bestMoney || 0, world.money);
  world.save.playTime = Math.round(world.playTime || 0);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(world.save));
    world.hasSave = true;
  } catch {
    // Storage can be unavailable (private mode); the game simply plays on.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function applySaveToState(world) {
  world.money = world.save.money || 0;
  world.xp = world.save.xp || 0;
  world.missionsDone = world.save.missionsDone || 0;
  world.playTime = world.save.playTime || 0;
}
