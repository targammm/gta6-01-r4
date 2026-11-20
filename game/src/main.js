// main.js — boot: build the world, wire the fixed-step loop, handle shot mode.
import { createWorld, stepWorld, startGame } from './world.js';
import { renderFrame, handleResize } from './render.js';
import { updateHud } from './hud.js';
import { applyShotStaging } from './shots.js';

const params = new URLSearchParams(globalThis.location.search);
const seed = Number(params.get('seed') || '20261120');
const shotName = params.get('shot');

const canvas = document.getElementById('game-canvas');
const hudRoot = document.getElementById('hud');
const state = createWorld(canvas, hudRoot, seed);
globalThis.__solmar = state;

if (shotName) {
  state.shotMode = true;
  applyShotStaging(state, shotName, stepWorld);
  // One HUD + render pass so the captured frame shows final values.
  updateHud(state);
  renderFrame(state.render);
  globalThis.__shotReady = true;
} else {
  let last = performance.now();
  let accumulator = 0;
  const STEP = 1 / 60;
  function frame(now) {
    requestAnimationFrame(frame);
    let delta = (now - last) / 1000;
    last = now;
    if (delta > 0.25) delta = 0.25;
    accumulator += delta;
    if (state.phase === 'title' && state.input.pressed.has('Enter')) {
      startGame(state);
    }
    while (accumulator >= STEP) {
      stepWorld(state, STEP);
      accumulator -= STEP;
    }
    renderFrame(state.render);
  }
  globalThis.addEventListener('resize', () => handleResize(state.render, canvas));
  requestAnimationFrame(frame);
}
