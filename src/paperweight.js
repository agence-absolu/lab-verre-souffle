import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  uniform,
  vec3,
  mix,
  floor,
  hash,
  dot,
  pow,
  normalize,
  normalView,
  positionLocal,
  positionWorld,
  positionViewDirection,
  transformNormalToView,
  mx_noise_vec3,
  mx_fractal_noise_float,
} from 'three/tsl';
import { BASE_Y, FRIT_RADIUS, FRIT_HEIGHT, seeded } from './constants.js';
import { GLASS_SHAPES, createGlassGeometry, inShell } from './shapes.js';
import { createMillefiori, createTorsade } from './inclusions.js';

// Réglable depuis le panneau : amplitude de l'ondulation de la normale du verre.
export const glassWobble = uniform(0.02);

function createGlassMaterial() {
  const material = new THREE.MeshPhysicalNodeMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,
    transmission: 1,
    thickness: 0.6,
    ior: 1.52,
    dispersion: 0.6,
    attenuationColor: new THREE.Color(0xe8f3ff), // très léger bleu-vert du verre épais
    attenuationDistance: 3.5,
    specularIntensity: 1,
    envMapIntensity: 1.2,
    side: THREE.FrontSide,
  });

  // Verre soufflé à la main : la surface n'est jamais parfaitement régulière.
  // Un bruit basse fréquence perturbe très légèrement la normale (en espace
  // vue, comme l'attend normalNode) : les reflets ondulent au lieu de glisser
  // comme sur une sphère de CAO.
  material.normalNode = Fn(() => {
    // transformNormalToView renormalise : l'amplitude s'applique après, pas avant.
    const wobble = mx_noise_vec3(positionLocal.mul(2.2).add(vec3(3.1, 0.7, 5.3)));
    return normalize(normalView.add(transformNormalToView(wobble).mul(glassWobble)));
  })();

  return material;
}

// Matériau des bulles d'air : sphère chromée plus claire sur le bord
// (réflexion totale) — l'illusion suffit à cette échelle.
function createBubbleMaterial() {
  const material = new THREE.MeshStandardNodeMaterial({ metalness: 1, roughness: 0.05, envMapIntensity: 1.4 });
  material.colorNode = Fn(() => {
    const facing = dot(normalView, positionViewDirection).clamp(0, 1);
    const rim = pow(float(1).sub(facing), 2.5);
    return mix(vec3(0.55, 0.6, 0.68), vec3(1.0), rim);
  })();
  return material;
}

// Bulles prises dans la masse : semées dans la coque de la forme courante.
const BUBBLE_MAX = 60;

function createBubbles() {
  return new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), createBubbleMaterial(), BUBBLE_MAX);
}

function seedBubbles(bubbles, shape) {
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const rand = seeded(7);
  const spanY = shape.topY - shape.baseY;
  const spanR = Math.max(shape.maxRadius, shape.baseRadius);

  let placed = 0;
  let tries = 0;
  while (placed < BUBBLE_MAX && tries++ < 5000) {
    p.set((rand() * 2 - 1) * spanR, shape.baseY + rand() * spanY, (rand() * 2 - 1) * spanR);
    if (!inShell(shape, p)) continue;
    const s = 0.004 + rand() ** 2 * 0.012;
    m.makeScale(s, s, s).setPosition(p);
    bubbles.setMatrixAt(placed++, m);
  }
  bubbles.instanceMatrix.needsUpdate = true;
}

// Lit de frit : le tapis de verre broyé sur lequel repose la composition.
// Couleur calculée en TSL — une grille de cellules, chacune tirant sa couleur
// de la palette, avec un bruit fractal pour casser la régularité.
// Palette : cobalt, sarcelle, violet, rehauts blancs et or.
const FRIT_PALETTE = [vec3(0.05, 0.08, 0.32), vec3(0.08, 0.45, 0.42), vec3(0.28, 0.1, 0.4), vec3(0.92, 0.9, 0.85), vec3(0.95, 0.72, 0.25)];

function createFritBed(palette = FRIT_PALETTE) {
  const geometry = new THREE.SphereGeometry(1, 96, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0 });

  material.colorNode = Fn(() => {
    // Grille en espace monde (l'objet est aplati : en local les cellules seraient
    // des lamelles), déformée par un bruit pour casser l'alignement.
    // hash() convertit sa graine en entier non signé : on décale les coordonnées
    // pour rester en positif, sinon toutes les cellules négatives se confondent.
    const jitter = mx_noise_vec3(positionWorld.mul(9)).mul(0.6);
    const cell = floor(positionWorld.add(10).mul(22).add(jitter));
    const h = hash(dot(cell, vec3(1, 57, 113)));
    const h2 = hash(dot(cell, vec3(7, 31, 17)).add(1.7));

    const [deep, second, third, light, accent] = palette;
    let c = mix(deep, second, h.smoothstep(0.3, 0.45));
    c = mix(c, third, h.smoothstep(0.62, 0.7));
    c = mix(c, light, h.smoothstep(0.86, 0.9));
    c = mix(c, accent, h.smoothstep(0.94, 0.95));

    const grain = mx_fractal_noise_float(positionWorld.mul(40), 3).mul(0.25).add(1);
    return c.mul(grain).mul(mix(0.75, 1.15, h2));
  })();

  const bed = new THREE.Mesh(geometry, material);
  bed.scale.set(FRIT_RADIUS, FRIT_HEIGHT, FRIT_RADIUS);
  bed.position.y = BASE_Y + 0.012;
  return bed;
}

const DOME_BASE_RADIUS = GLASS_SHAPES.dome.baseRadius;

export function createPaperweight(shapeKey = 'dome') {
  const group = new THREE.Group();

  const dome = new THREE.Mesh(new THREE.BufferGeometry(), createGlassMaterial());
  dome.renderOrder = 10; // le verre se dessine en dernier : tout l'intérieur est déjà là
  group.add(dome);

  const bubbles = createBubbles();
  group.add(bubbles);

  // Le sol (frit, millefiori, torsade) est construit pour le dôme de référence ;
  // pour les autres formes on le met à l'échelle du méplat et on le repose dessus.
  const ground = new THREE.Group();
  const fritBed = createFritBed();
  const millefiori = createMillefiori();
  const torsade = createTorsade();
  ground.add(fritBed, millefiori, torsade);
  group.add(ground);

  let shape = null;
  let groundScale = 1;

  // L'épaisseur de transmission de three est une distance monde : la même
  // valeur grossit bien plus dans une forme étroite (œuf) que dans le dôme.
  // On la proportionne au plus grand rayon de la forme.
  let thicknessBase = 0.6;
  const applyThickness = () => (dome.material.thickness = thicknessBase * shape.maxRadius);
  const setThickness = (value) => {
    thicknessBase = value;
    applyThickness();
  };

  const setShape = (key) => {
    shape = GLASS_SHAPES[key];
    dome.geometry.dispose();
    dome.geometry = createGlassGeometry(shape);
    applyThickness();
    seedBubbles(bubbles, shape);
    groundScale = Math.min(1, shape.baseRadius / DOME_BASE_RADIUS);
    ground.scale.setScalar(groundScale);
    ground.position.y = shape.baseY - BASE_Y * groundScale;
    return shape;
  };
  setShape(shapeKey);

  // Hauteur du sommet du lit de frit, là où planter les objets.
  const groundTopY = () => shape.baseY + (0.012 + FRIT_HEIGHT) * groundScale;

  return {
    group,
    dome,
    bubbles,
    ground,
    fritBed,
    millefiori,
    torsade,
    setShape,
    setThickness,
    thicknessBase,
    groundTopY,
    get shape() {
      return shape;
    },
  };
}
