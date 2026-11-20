// render.js — the three.js renderer, warm late-afternoon lighting, fog, a
// sun disc and a few flat clouds. The city itself is built by city.js.

import * as THREE from 'three';
import { PALETTE } from './config.js';
import { createSeededRandom } from './random.js';

export function createRender(world) {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 72, 130);
  camera.lookAt(0, 10, 0);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(120, 140, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x8a6f4d, 0.9);
  scene.add(hemi);

  const fill = new THREE.DirectionalLight(0xffd9a8, 0.35);
  fill.position.set(-80, 40, -100);
  scene.add(fill);

  // Sun disc and a scatter of flat clouds, placed from a fixed offset seed
  // so every world looks the same.
  const rng = createSeededRandom((world.seed || 1) + 777);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(18, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff3cf, fog: false })
  );
  disc.position.set(180, 150, -260);
  disc.lookAt(0, 40, 0);
  scene.add(disc);

  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    const cx = rng.range(-260, 260);
    const cz = rng.range(-260, 260);
    const cy = rng.range(95, 123);
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set(rng.range(-9, 9), rng.range(-1.5, 1.5), rng.range(-4, 4));
      puff.scale.set(rng.range(9, 16), rng.range(2.2, 3.4), rng.range(5, 8));
      cloud.add(puff);
    }
    cloud.position.set(cx, cy, cz);
    scene.add(cloud);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, sun };
}

export function renderFrame(world) {
  world.render.renderer.render(world.render.scene, world.render.camera);
}
