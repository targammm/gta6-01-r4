// save.js — localStorage persistence for money, XP, mission progress and play time.
import { SAVE_KEY, createDefaultSave } from './config.js';

export function loadSave() {
  try {
    const raw = globalThis.localStorage ? globalThis.localStorage.getItem(SAVE_KEY) : null;
    if (!raw) return createDefaultSave();
    const parsed = JSON.parse(raw);
    const base = createDefaultSave();
    for (const key of Object.keys(base)) {
      if (typeof parsed[key] === 'number' && Number.isFinite(parsed[key])) base[key] = parsed[key];
    }
    return base;
  } catch (err) {
    return createDefaultSave();
  }
}

export function writeSave(save) {
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (err) {
    // storage can be unavailable (private mode); the game simply runs unsaved
  }
}

export function clearSave() {
  try {
    if (globalThis.localStorage) globalThis.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // nothing to clear when storage is unavailable
  }
}

export function applySaveToState(save, state) {
  state.money = save.money;
  state.xp = save.xp;
  state.save = save;
  if (save.money > save.bestMoney) save.bestMoney = save.money;
  return state;
}
