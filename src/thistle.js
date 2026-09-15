import * as THREE from 'three/webgpu';
import { Fn, vec3, color, mix, uv, floor, fract, hash, dot, atan, asin, smoothstep, mx_noise_float, positionGeometry } from 'three/tsl';
import { FOOT_Y, seeded } from './constants.js';

// Chardon : un capitule écailleux hérissé de piquants, d'où jaillit un panache
// de centaines de filaments crème virant au violet. Tout est instancié : un
// seul tube courbe sert à tous les fleurons, un seul cône à tous les piquants.

const HEAD_Y = -0.1;
const HEAD_R = 0.19;
const HEAD_H = 0.23;

// Point de l'ellipsoïde du capitule et sa normale, pour une latitude v ∈ [-1, 1]
// (fraction de la demi-hauteur) et une longitude a.
function onHead(v, a, out, normal) {
  const ring = Math.sqrt(1 - v * v);
  out.set(Math.cos(a) * ring * HEAD_R, HEAD_Y + v * HEAD_H, Math.sin(a) * ring * HEAD_R);
  // Normale d'un ellipsoïde : composantes divisées par le carré des demi-axes.
  normal.set(Math.cos(a) * ring / HEAD_R, v / HEAD_H, Math.sin(a) * ring / HEAD_R).normalize();
}

function createHead() {
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.75 });
  material.colorNode = Fn(() => {
    // Écailles : cellules en quinconce sur la sphère unité (positionGeometry).
    const p = positionGeometry;
    const lat = asin(p.y.clamp(-1, 1));
    const lon = atan(p.z, p.x);
    const row = floor(lat.mul(7).add(3.5));
    const col = floor(lon.mul(16 / (Math.PI * 2)).add(fract(row.mul(0.5))).add(8));
    const h = hash(dot(vec3(row, col, 1), vec3(1, 57, 113)));
    // Bord des écailles : plus sombre.
    const cx = fract(lon.mul(16 / (Math.PI * 2)).add(fract(row.mul(0.5))));
    const cy = fract(lat.mul(7).add(3.5));
    const edge = smoothstep(0.0, 0.18, cx.min(cx.oneMinus())).mul(smoothstep(0.0, 0.25, cy.min(cy.oneMinus())));
    const base = mix(color(0x5c6a2e), color(0x8e9a4c), h);
    const tipPurple = mix(base, color(0x7a5c8a), smoothstep(0.55, 0.95, p.y));
    const speckle = mx_noise_float(p.mul(30)).mul(0.08);
    return tipPurple.mul(mix(0.55, 1, edge)).add(speckle);
  })();
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material);
  head.scale.set(HEAD_R, HEAD_H, HEAD_R);
  head.position.y = HEAD_Y;
  return head;
}

function createSpikes(rand) {
  const count = 170;
  const geometry = new THREE.ConeGeometry(1, 1, 5, 1);
  geometry.translate(0, 0.5, 0); // base à l'origine, pointe vers +y
  const material = new THREE.MeshStandardNodeMaterial({ color: 0xd9cf9c, roughness: 0.6 });
  const spikes = new THREE.InstancedMesh(geometry, material, count);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    onHead(-0.85 + rand() * 1.35, rand() * Math.PI * 2, pos, normal);
    dir.copy(normal).addScaledVector(up, 0.7).normalize(); // piquants relevés
    q.setFromUnitVectors(up, dir);
    const len = 0.035 + rand() * 0.03;
    m.compose(pos, q, new THREE.Vector3(0.006, len, 0.006));
    spikes.setMatrixAt(i, m);
  }
  spikes.instanceMatrix.needsUpdate = true;
  return spikes;
}

function createFlorets(rand) {
  const count = 800;
  // Un filament : tube fin le long d'une courbe douce, unité de longueur 1.
  const path = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.1, 0.55, 0),
    new THREE.Vector3(0.02, 1, 0),
  );
  const geometry = new THREE.TubeGeometry(path, 10, 0.0022, 4, false);
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.7 });
  material.colorNode = Fn(() => {
    const t = uv().x; // le long du tube
    let c = mix(color(0xf6efdc), color(0xc78ad6), smoothstep(0.3, 0.8, t));
    c = mix(c, color(0x8f46a8), smoothstep(0.8, 1.0, t));
    return c.mul(mix(0.8, 1, t)); // base légèrement ombrée dans le capitule
  })();

  const florets = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    // Naissance sur la calotte du capitule, un peu enfoncée.
    const v = 0.55 + rand() * 0.45;
    onHead(v, rand() * Math.PI * 2, pos, normal);
    pos.addScaledVector(normal, -0.02);
    // Direction : normale relevée, avec un peu de désordre.
    dir.copy(normal).addScaledVector(up, 0.5);
    dir.x += (rand() - 0.5) * 0.35;
    dir.y += (rand() - 0.5) * 0.2;
    dir.z += (rand() - 0.5) * 0.35;
    dir.normalize();
    q.setFromUnitVectors(up, dir);
    roll.setFromAxisAngle(up, rand() * Math.PI * 2); // la courbe part dans un sens aléatoire
    q.multiply(roll);
    const len = 0.3 + rand() * 0.22;
    m.compose(pos, q, new THREE.Vector3(1, len, 1));
    florets.setMatrixAt(i, m);
  }
  florets.instanceMatrix.needsUpdate = true;
  return florets;
}

export function createThistle() {
  const thistle = new THREE.Group();
  const rand = seeded(303);

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.03, FOOT_Y, 0.02),
    new THREE.Vector3(0.03, FOOT_Y + 0.2, 0.04),
    new THREE.Vector3(0.0, HEAD_Y - HEAD_H + 0.06, 0.0),
  ]);
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(stemCurve, 24, 0.02, 10, false),
    new THREE.MeshStandardNodeMaterial({ color: 0x6b7a48, roughness: 0.65 }),
  );

  thistle.add(stem, createHead(), createSpikes(rand), createFlorets(rand));
  return thistle;
}
