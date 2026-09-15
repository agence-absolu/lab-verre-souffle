import './style.css';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment } from './environment.js';
import { createPaperweight } from './paperweight.js';
import { OBJECTS, disposeObject } from './objects.js';
import { GLASS_SHAPES } from './shapes.js';
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
  camera.position.set(0.8, 2.2, 4.9); // vue en plongée légère : la guirlande se lit autour de la fleur

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

  // Forme du verre et objet encapsulé se choisissent indépendamment ; l'URL
  // peut les fixer (?forme=egg&objet=thistle) pour partager une combinaison.
  const params = new URLSearchParams(location.search);
  const pick = (registry, value, fallbackKey) => (value in registry ? value : fallbackKey);
  const state = {
    shape: pick(GLASS_SHAPES, params.get('forme'), 'dome'),
    object: pick(OBJECTS, params.get('objet'), 'flower'),
  };
  const paperweight = createPaperweight(state.shape);
  scene.add(paperweight.group);

  let object = null;

  // Pose l'objet : pied planté dans le lit de frit s'il est là, sinon sur le méplat.
  const placeObject = () => {
    const def = OBJECTS[state.object];
    const { shape } = paperweight;
    const scale = def.fitToBase ? Math.min(1, shape.baseRadius / GLASS_SHAPES.dome.baseRadius) : 1;
    const footTarget = paperweight.ground.visible ? paperweight.groundTopY() - 0.06 : shape.baseY + 0.02;
    object.scale.setScalar(scale);
    object.position.y = footTarget - def.footY * scale;
  };

  const setObject = (key) => {
    state.object = key;
    if (object) disposeObject(object);
    object = OBJECTS[key].create();
    paperweight.group.add(object);
    paperweight.ground.visible = OBJECTS[key].ground;
    placeObject();
  };

  const setShape = (key) => {
    state.shape = key;
    const shape = paperweight.setShape(key);
    controls.target.y = shape.centerY - 0.1;
    placeObject();
  };

  setObject(state.object);
  setShape(state.shape);

  const post = createPostProcessing(renderer, scene, camera, controls);

  createPanel({ renderer, controls, paperweight, state, setShape, setObject, placeObject, post });

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
