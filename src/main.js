import './style.css';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment } from './environment.js';
import { createPaperweight } from './paperweight.js';
import { createFlower } from './flower.js';
import { createPanel } from './panel.js';
import { createPostProcessing } from './postprocess.js';

const canvas = document.getElementById('scene');
const backendLabel = document.getElementById('backend');
const hint = document.getElementById('hint');
const fallback = document.getElementById('fallback');

async function start() {
  // Sans WebGPU, le renderer bascule seul sur WebGL 2 : mêmes nœuds TSL, même
  // rendu. `?webgl` force ce repli, pour comparer les deux backends.
  const forceWebGL = new URLSearchParams(location.search).has('webgl');
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL });
  await renderer.init();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  backendLabel.textContent = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.set(0.7, 1.3, 5.4);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.02, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 2.4;
  controls.maxDistance = 6.5;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; // jamais sous la table
  controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 0.5;

  // L'indication disparaît dès la première manipulation.
  controls.addEventListener('start', () => hint.classList.add('is-hidden'), { once: true });

  createEnvironment(renderer, scene);

  const { group: paperweight, dome, bubbles, fritBed } = createPaperweight();
  const flower = createFlower();
  paperweight.add(flower);
  scene.add(paperweight);

  const post = createPostProcessing(renderer, scene, camera, controls);

  createPanel({ renderer, controls, dome, bubbles, fritBed, flower, post });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(() => {
    controls.update();
    post.render();
  });
}

start().catch((error) => {
  console.error(error);
  fallback.hidden = false;
  canvas.hidden = true;
});
