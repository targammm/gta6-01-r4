// input.js — keyboard and mouse state. Keys are tracked as held and as
// pressed-this-step; the mouse drives the camera through pointer lock when
// available and through a plain drag otherwise.

export function createInput(world) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseDown: false,
    mousePressed: false,
    dragging: false,
    yawDelta: 0,
    pitchDelta: 0,
  };
  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
      input.dragging = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      input.mouseDown = false;
      input.dragging = false;
    }
  });
  window.addEventListener('mousemove', (e) => {
    const canvas = document.getElementById('game');
    if (document.pointerLockElement === canvas || input.dragging) {
      input.yawDelta += e.movementX || 0;
      input.pitchDelta += e.movementY || 0;
    }
  });
  const canvas = document.getElementById('game');
  if (canvas) {
    canvas.addEventListener('click', () => {
      if (world.phase === 'play' && !world.shotMode) {
        try {
          canvas.requestPointerLock();
        } catch {
          // Pointer lock is a nicety; drag-look still works without it.
        }
      }
    });
  }
  return input;
}

// On-foot axes: forward is +1 when W is held, strafe is +1 when D is held.
export function readMoveAxes(input) {
  const forward =
    (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0) -
    (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0);
  const strafe =
    (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0) -
    (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0);
  return { forward, strafe };
}

export function wasPressed(input, code) {
  return input.pressed.has(code);
}

// Driving axes: throttle +1 accelerates, -1 brakes/reverses; steer +1 is
// left (A), -1 is right (D); Space is the handbrake.
export function driveAxes(input) {
  const throttle =
    (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0) -
    (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0);
  const steer =
    (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0) -
    (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0);
  return { throttle, steer, brake: input.keys.has('Space') };
}

export function endInputStep(input) {
  input.pressed.clear();
  input.mousePressed = false;
  input.yawDelta = 0;
  input.pitchDelta = 0;
}
