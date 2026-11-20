// input.js — keyboard state, one-shot presses, and mouse look (pointer lock with drag fallback).
import { clamp } from './random.js';

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    clicked: false,
    locked: false,
    dragLooking: false,
    lastX: 0,
    lastY: 0,
  };

  globalThis.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    input.keys.add(ev.code);
    input.pressed.add(ev.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
  });
  globalThis.addEventListener('keyup', (ev) => {
    input.keys.delete(ev.code);
  });
  globalThis.addEventListener('blur', () => {
    input.keys.clear();
  });

  if (canvas) {
    canvas.addEventListener('mousedown', (ev) => {
      input.mouseDown = true;
      input.clicked = true;
      input.dragLooking = true;
      input.lastX = ev.clientX;
      input.lastY = ev.clientY;
      if (canvas.requestPointerLock && !input.locked) {
        try { canvas.requestPointerLock(); } catch (err) { /* drag fallback stays active */ }
      }
    });
    globalThis.addEventListener('mouseup', () => {
      input.mouseDown = false;
      input.dragLooking = false;
    });
    globalThis.addEventListener('mousemove', (ev) => {
      if (input.locked) {
        input.mouseDX += ev.movementX || 0;
        input.mouseDY += ev.movementY || 0;
      } else if (input.dragLooking) {
        input.mouseDX += (ev.clientX - input.lastX) * 1.6;
        input.mouseDY += (ev.clientY - input.lastY) * 1.6;
        input.lastX = ev.clientX;
        input.lastY = ev.clientY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      input.locked = document.pointerLockElement === canvas;
    });
  }
  return input;
}

export function readMoveAxes(input) {
  let forward = 0;
  let strafe = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) forward += 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) forward -= 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) strafe -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) strafe += 1;
  return { forward, strafe };
}

export function driveAxes(input) {
  let throttle = 0;
  let steer = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) throttle += 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) throttle -= 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) steer += 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) steer -= 1;
  const brake = input.keys.has('Space');
  return { throttle, steer: clamp(steer, -1, 1), brake };
}

export function wasPressed(input, code) {
  return input.pressed.has(code);
}

export function endInputStep(input) {
  input.pressed.clear();
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.clicked = false;
}
