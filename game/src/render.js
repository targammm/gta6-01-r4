// render.js — three.js renderer, warm coastal lighting, sky dome, sun disc and drifting clouds.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0xffd9a3, 120, 420);

  const camera = new THREE.PerspectiveCamera(62, globalThis.innerWidth / globalThis.innerHeight, 0.1, 900);
  camera.position.set(0, 72, 130);

  const sun = new THREE.DirectionalLight(0xfff2cf, 2.6);
  sun.position.set(120, 140, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7f6a, 0.9);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xffd9b0, 0.35);
  fill.position.set(-80, 40, -100);
  scene.add(fill);

  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false })
  );
  sunDisc.position.set(180, 150, -260);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);

  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfff4e0, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    const cx = -260 + (i % 5) * 120 + (i * 37) % 40;
    const cz = -220 + Math.floor(i / 5) * 190 + (i * 53) % 60;
    const cy = 95 + (i * 29) % 28;
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(9 + (j * 5) % 8, 10, 8), cloudMat);
      puff.position.set(j * 11 - 11, (j % 2) * 2, (j * 7) % 6);
      puff.scale.y = 0.38;
      cloud.add(puff);
    }
    cloud.position.set(cx, cy, cz);
    clouds.add(cloud);
  }
  scene.add(clouds);

  globalThis.addEventListener('resize', () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  });

  return { renderer, scene, camera, sun, clouds };
}

export function renderFrame(render) {
  render.renderer.render(render.scene, render.camera);
}

export function handleResize(render, canvas) {
  const w = canvas.clientWidth || globalThis.innerWidth || 1280;
  const h = canvas.clientHeight || globalThis.innerHeight || 720;
  render.camera.aspect = w / h;
  render.camera.updateProjectionMatrix();
  render.renderer.setSize(w, h, false);
}
