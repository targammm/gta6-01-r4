// main.js — boot: build the world from the seed, then either stage one
// deterministic screenshot (?shot=chase|city|mission|title&seed=N) or run
// the live game on a fixed-step accumulator.

import { createWorld, stepWorld } from './world.js';
import { applyShotStaging } from './shots.js';
import { renderFrame } from './render.js';
import { updateHud } from './hud.js';
import { WORLD } from './config.js';

function readBootParams() {
  const params = new URLSearchParams(window.location.search);
  const seedParam = parseInt(params.get('seed') || '', 10);
  return {
    seed: Number.isFinite(seedParam) ? seedParam : 20261120,
    shot: params.get('shot'),
  };
}

const { seed, shot } = readBootParams();
const world = createWorld(seed);
window.__solmar = world;

if (shot) {
  applyShotStaging(world, shot);
  updateHud(world, 0);
  renderFrame(world);
  window.__shotReady = true;
} else {
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= WORLD.step && steps < 5) {
      stepWorld(world, WORLD.step);
      acc -= WORLD.step;
      steps++;
    }
    if (steps === 5) acc = 0; // slow device: drop the backlog, stay smooth
    renderFrame(world);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
