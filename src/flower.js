import * as THREE from 'three/webgpu';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';
import { Fn, float, vec2, vec3, color, mix, uv, sin, smoothstep, hue, uniform, mx_noise_float, positionLocal } from 'three/tsl';
import { seeded } from './paperweight.js';

// Réglable depuis le panneau : rotation de teinte des pétales (radians).
export const petalHue = uniform(0);

// Fleur de verre filé (« lampwork ») à la manière des presse-papiers anciens :
// deux couronnes de pétales, un cœur piqueté d'étamines, une tige et deux
// feuilles. Toute la géométrie est procédurale, toutes les couleurs en TSL.

// Pétale : surface paramétrique. u court le long du pétale (base → pointe),
// v le traverse. Largeur en cloche, creux transversal, et courbure vers
// l'arrière qui s'accentue à la pointe.
function createPetalGeometry({ length = 1, width = 0.42, cup = 0.28, curl = 0.55, tipPinch = 0.5 } = {}) {
  return new ParametricGeometry(
    (u, v, target) => {
      const halfWidth = Math.sin(Math.PI * u) ** tipPinch * width;
      const x = (v - 0.5) * 2 * halfWidth;
      const y = u * length;
      const across = halfWidth > 0 ? x / Math.max(halfWidth, 1e-4) : 0;
      // Creux vers l'axe de la fleur (-z), pointe qui retombe vers l'extérieur (+z).
      const z = -across * across * cup * halfWidth + curl * u * u * length;
      target.set(x, y, z);
    },
    32,
    16,
  );
}

// Feuille : plus effilée, pliée en V le long de la nervure centrale.
function createLeafGeometry({ length = 1, width = 0.14 } = {}) {
  return new ParametricGeometry(
    (u, v, target) => {
      const halfWidth = Math.sin(Math.PI * u) ** 0.85 * width * (1 - 0.15 * u);
      const x = (v - 0.5) * 2 * halfWidth;
      const y = u * length;
      const z = -Math.abs(x) * 0.45 + u * u * 0.25 * length;
      target.set(x, y, z);
    },
    24,
    8,
  );
}

function createPetalMaterial({ base, mid, tip, seed }) {
  const material = new THREE.MeshPhysicalNodeMaterial({
    roughness: 0.38,
    metalness: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xffc7d6),
    sheenRoughness: 0.7,
    side: THREE.DoubleSide,
    envMapIntensity: 0.45,
  });

  material.colorNode = Fn(() => {
    // ParametricGeometry range u dans uv.x (base → pointe) et v dans uv.y (travers).
    const t = uv().x;
    const s = uv().y.sub(0.5).abs().mul(2); // nervure centrale → bord
    // color() attend du sRGB et convertit en linéaire : les teintes se lisent comme en CSS.
    let c = mix(color(base), color(mid), t.smoothstep(0.05, 0.55));
    c = mix(c, color(tip), t.smoothstep(0.55, 1.0));
    // Nervures : stries fines qui se resserrent vers la base.
    const veins = sin(uv().y.mul(38).add(mx_noise_float(vec3(uv().mul(vec2(9, 3)), seed)).mul(4)))
      .mul(0.5)
      .add(0.5)
      .pow(3)
      .mul(float(1).sub(t).mul(0.14));
    // Bords légèrement plus clairs, comme un verre plus fin.
    const edge = smoothstep(0.55, 1.0, s).mul(0.12);
    return hue(c.sub(veins).add(edge).clamp(0, 1), petalHue);
  })();

  return material;
}

function createGreenMaterial() {
  const material = new THREE.MeshPhysicalNodeMaterial({
    roughness: 0.35,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    side: THREE.DoubleSide,
  });
  material.colorNode = Fn(() => {
    const t = uv().x;
    const midrib = float(1).sub(smoothstep(0.0, 0.06, uv().y.sub(0.5).abs())).mul(0.25);
    const c = mix(color(0x1f5a2a), color(0x5f9a3c), t.smoothstep(0, 1));
    const speckle = mx_noise_float(positionLocal.mul(40)).mul(0.06);
    return c.add(midrib).add(speckle);
  })();
  return material;
}

function createPetalRing(group, { count, length, width, tilt, radius, height, material, seed, curl }) {
  const rand = seeded(seed);
  const geometry = createPetalGeometry({ length, width, curl });
  for (let i = 0; i < count; i++) {
    const petal = new THREE.Mesh(geometry, material);
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    const scale = 0.92 + rand() * 0.16;
    const pivot = new THREE.Group();
    pivot.rotation.y = angle;
    petal.position.set(0, height, radius);
    petal.rotation.x = tilt + (rand() - 0.5) * 0.18;
    petal.rotation.z = (rand() - 0.5) * 0.1;
    petal.scale.setScalar(scale);
    pivot.add(petal);
    group.add(pivot);
  }
}

function createHeart(group) {
  // Cœur : une petite sphère aplatie, jaune-vert piqueté.
  const heartMaterial = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.5, clearcoat: 0.3 });
  heartMaterial.colorNode = Fn(() => {
    const n = mx_noise_float(positionLocal.mul(60)).mul(0.5).add(0.5);
    return mix(color(0x9aa02a), color(0xfad55a), n.smoothstep(0.35, 0.7));
  })();
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.085, 32, 20), heartMaterial);
  heart.scale.y = 0.7;
  heart.position.y = 0.035;
  group.add(heart);

  // Étamines : filaments fins terminés par une anthère, en instances.
  const count = 22;
  const rand = seeded(23);
  const filamentGeometry = new THREE.CylinderGeometry(0.003, 0.0045, 1, 6, 1, false);
  filamentGeometry.translate(0, 0.5, 0);
  const filaments = new THREE.InstancedMesh(
    filamentGeometry,
    new THREE.MeshStandardNodeMaterial({ color: 0xfff1b8, roughness: 0.4 }),
    count,
  );
  const antherMaterial = new THREE.MeshPhysicalNodeMaterial({ color: 0xffb347, roughness: 0.35, clearcoat: 0.6 });
  const anthers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 10, 8), antherMaterial, count);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.4;
    const spread = 0.25 + rand() * 0.55; // ouverture du cône
    dir.set(Math.sin(a) * Math.sin(spread), Math.cos(spread), Math.cos(a) * Math.sin(spread)).normalize();
    const len = 0.11 + rand() * 0.07;
    q.setFromUnitVectors(up, dir);
    pos.set(0, 0.045, 0).addScaledVector(dir, 0.04);
    m.compose(pos, q, new THREE.Vector3(1, len, 1));
    filaments.setMatrixAt(i, m);
    pos.addScaledVector(dir, len);
    m.compose(pos, q, new THREE.Vector3(1, 1, 1));
    anthers.setMatrixAt(i, m);
  }
  filaments.instanceMatrix.needsUpdate = true;
  anthers.instanceMatrix.needsUpdate = true;
  group.add(filaments, anthers);
}

export function createFlower() {
  const flower = new THREE.Group();
  // La fleur est petite et posée bas : c'est le dôme qui la grossit, comme
  // dans un vrai presse-papier. Mise à l'échelle autour du pied de la tige.
  const scale = 0.75;
  const footY = -0.66;
  // Hauteur de la corolle (repère de la fleur) : une fois mise à l'échelle,
  // elle arrive un peu au-dessus du centre du dôme.
  const bloomY = 0.33;
  flower.scale.setScalar(scale);
  flower.position.y = footY * (1 - scale);

  // Tige : tube le long d'une courbe légèrement sinueuse, du lit de frit au cœur.
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.06, footY, 0.03),
    new THREE.Vector3(0.06, -0.38, 0.07),
    new THREE.Vector3(-0.02, -0.1, 0.0),
    new THREE.Vector3(0.0, 0.16, -0.03),
    new THREE.Vector3(0.0, bloomY, 0.0),
  ]);
  const greenMaterial = createGreenMaterial();
  const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 40, 0.017, 10, false), greenMaterial);
  flower.add(stem);

  // Feuilles : accrochées sur la tige, orientées vers l'extérieur et le haut.
  const leafGeometry = createLeafGeometry({ length: 0.42, width: 0.12 });
  const leafSpecs = [
    { t: 0.28, yaw: 0.9, pitch: 1.15 },
    { t: 0.5, yaw: -2.2, pitch: 1.0 },
  ];
  for (const { t, yaw, pitch } of leafSpecs) {
    const leaf = new THREE.Mesh(leafGeometry, greenMaterial);
    const pivot = new THREE.Group();
    pivot.position.copy(stemCurve.getPointAt(t));
    pivot.rotation.y = yaw;
    leaf.rotation.x = pitch;
    leaf.rotation.z = 0.15;
    pivot.add(leaf);
    flower.add(pivot);
  }

  // Corolle : légèrement inclinée vers l'avant pour qu'on la voie de face.
  const bloom = new THREE.Group();
  bloom.position.y = bloomY;
  bloom.rotation.set(0.28, 0.4, 0.08);
  flower.add(bloom);

  const outer = createPetalMaterial({
    base: 0x6e0a2e,
    mid: 0xc42a5e,
    tip: 0xf08aa8,
    seed: 1.3,
  });
  const inner = createPetalMaterial({
    base: 0x8e1c46,
    mid: 0xd94a7a,
    tip: 0xf7a6bf,
    seed: 4.7,
  });

  createPetalRing(bloom, {
    count: 10,
    length: 0.44,
    width: 0.24,
    tilt: 1.2,
    radius: 0.06,
    height: -0.01,
    material: outer,
    seed: 11,
    curl: 0.75,
  });
  createPetalRing(bloom, {
    count: 9,
    length: 0.34,
    width: 0.22,
    tilt: 0.85,
    radius: 0.045,
    height: 0.0,
    material: inner,
    seed: 29,
    curl: 0.55,
  });
  createPetalRing(bloom, {
    count: 7,
    length: 0.22,
    width: 0.2,
    tilt: 0.5,
    radius: 0.03,
    height: 0.01,
    material: inner,
    seed: 37,
    curl: 0.3,
  });

  createHeart(bloom);

  return flower;
}
