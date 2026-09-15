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

// Réglables depuis le panneau : amplitude de l'ondulation de la normale du verre.
export const glassWobble = uniform(0.02);

export const RADIUS = 1;
export const BASE_Y = -0.7; // hauteur du méplat : un presse-papier a le fond poli à plat

// Profil du presse-papier : disque de base, petit chanfrein poli, puis arc de
// sphère jusqu'au sommet. Tourné autour de l'axe Y par LatheGeometry.
function createDomeGeometry() {
  const points = [];
  const chamfer = 0.05;
  const baseRadius = Math.sqrt(RADIUS * RADIUS - BASE_Y * BASE_Y);

  points.push(new THREE.Vector2(0, BASE_Y));
  points.push(new THREE.Vector2(baseRadius - chamfer, BASE_Y));

  // L'arc de sphère démarre là où le chanfrein le rejoint.
  const startAngle = Math.asin((BASE_Y + chamfer) / RADIUS);
  const arcSteps = 96;
  for (let i = 0; i <= arcSteps; i++) {
    const t = i / arcSteps;
    const a = startAngle + t * (Math.PI / 2 - startAngle);
    points.push(new THREE.Vector2(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS));
  }

  return new THREE.LatheGeometry(points, 192);
}

function createGlassMaterial() {
  const material = new THREE.MeshPhysicalNodeMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,
    transmission: 1,
    thickness: 0.75,
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

// Bulles d'air prises dans la masse : de minuscules sphères chromées, plus
// claires sur le bord (réflexion totale) — l'illusion suffit à cette échelle.
function createBubbles(count = 60) {
  const geometry = new THREE.SphereGeometry(1, 12, 8);
  const material = new THREE.MeshStandardNodeMaterial({ metalness: 1, roughness: 0.05, envMapIntensity: 1.4 });
  material.colorNode = Fn(() => {
    const facing = dot(normalView, positionViewDirection).clamp(0, 1);
    const rim = pow(float(1).sub(facing), 2.5);
    return mix(vec3(0.55, 0.6, 0.68), vec3(1.0), rim);
  })();

  const bubbles = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const rand = seeded(7);

  let placed = 0;
  while (placed < count) {
    p.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    const r = p.length();
    // Dans la coque du dôme, pas au cœur (où vit la fleur), pas sous le méplat.
    if (r < 0.62 || r > 0.9 || p.y < BASE_Y + 0.12) continue;
    const s = 0.004 + rand() ** 2 * 0.012;
    m.makeScale(s, s, s).setPosition(p);
    bubbles.setMatrixAt(placed++, m);
  }
  bubbles.instanceMatrix.needsUpdate = true;
  return bubbles;
}

// Lit de frit : le tapis de verre broyé multicolore sur lequel repose la fleur.
// Couleur calculée en TSL — une grille de cellules, chacune tirant sa couleur
// d'une petite palette, avec un bruit fractal pour casser la régularité.
function createFritBed() {
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

    const deep = vec3(0.05, 0.08, 0.32); // cobalt
    const teal = vec3(0.08, 0.45, 0.42);
    const violet = vec3(0.28, 0.1, 0.4);
    const white = vec3(0.92, 0.9, 0.85);
    const gold = vec3(0.95, 0.72, 0.25);

    let c = mix(deep, teal, h.smoothstep(0.3, 0.45));
    c = mix(c, violet, h.smoothstep(0.62, 0.7));
    c = mix(c, white, h.smoothstep(0.86, 0.9));
    c = mix(c, gold, h.smoothstep(0.94, 0.95));

    const grain = mx_fractal_noise_float(positionWorld.mul(40), 3).mul(0.25).add(1);
    return c.mul(grain).mul(mix(0.75, 1.15, h2));
  })();

  const bed = new THREE.Mesh(geometry, material);
  bed.scale.set(0.6, 0.11, 0.6);
  bed.position.y = BASE_Y + 0.012;
  return bed;
}

export function createPaperweight() {
  const group = new THREE.Group();

  const dome = new THREE.Mesh(createDomeGeometry(), createGlassMaterial());
  dome.renderOrder = 10; // le verre se dessine en dernier : tout l'intérieur est déjà là
  group.add(dome);

  const bubbles = createBubbles();
  const fritBed = createFritBed();
  group.add(bubbles, fritBed);

  return { group, dome, bubbles, fritBed };
}

// Petit générateur déterministe (mulberry32) : la disposition des bulles est la
// même à chaque chargement.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
