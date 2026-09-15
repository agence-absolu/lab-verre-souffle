import * as THREE from 'three/webgpu';
import { Fn, vec3, color, mix, uv, floor, fract, hash, dot, atan, asin, smoothstep, mx_noise_float, positionGeometry } from 'three/tsl';
import { seeded } from './constants.js';

// Chardon : un capitule écailleux hérissé de piquants, d'où jaillit un panache
// de centaines de filaments crème virant au violet. Tout est instancié : un
// seul tube courbe sert à tous les fleurons, un seul cône à tous les piquants.

const HEAD_Y = -0.1;
const HEAD_R = 0.07; // petit capitule : c'est le panache qu'on veut voir
const HEAD_H = 0.085;
// Pas de tige : la boule flotte dans le verre, capitule en dessous.
export const THISTLE_FOOT_Y = HEAD_Y - HEAD_H - 0.02;
export const THISTLE_TOP_Y = HEAD_Y + HEAD_H + 0.5;

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
  const count = 70;
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
    const len = 0.02 + rand() * 0.015;
    m.compose(pos, q, new THREE.Vector3(0.0035, len, 0.0035));
    spikes.setMatrixAt(i, m);
  }
  spikes.instanceMatrix.needsUpdate = true;
  return spikes;
}

function createFlorets(rand) {
  const count = 2600;
  // Un filament : tube fin presque droit, à peine incurvé vers +x local.
  // Unité de longueur 1.
  const path = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.0, 0.55, 0),
    new THREE.Vector3(0.12, 0.98, 0),
  );
  const geometry = new THREE.TubeGeometry(path, 8, 0.0022, 4, false);
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.7 });
  material.colorNode = Fn(() => {
    const t = uv().x; // le long du tube
    let c = mix(color(0xf6efdc), color(0xc78ad6), smoothstep(0.45, 0.85, t));
    c = mix(c, color(0x8f46a8), smoothstep(0.85, 1.0, t));
    return c.mul(mix(0.8, 1, t)); // base légèrement ombrée dans le capitule
  })();

  const florets = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const localX = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    // Le panache est une demi-sphère : les filaments rayonnent depuis la
    // calotte du capitule et presque tout le tour (~155°) : une boule, dont
    // seul le dessous laisse deviner le capitule. Répartition uniforme sur la
    // sphère (acos d'un tirage uniforme).
    const a = rand() * Math.PI * 2;
    const phi = Math.acos(1 - rand() * 1.9);
    dir.set(Math.sin(phi) * Math.cos(a), Math.cos(phi), Math.sin(phi) * Math.sin(a));
    dir.x += (rand() - 0.5) * 0.1;
    dir.y += (rand() - 0.5) * 0.1;
    dir.z += (rand() - 0.5) * 0.1;
    dir.normalize();
    // Naissance : haut de la calotte pour les filaments dressés, flancs pour
    // les filaments couchés, un peu enfoncée dans le capitule.
    onHead(Math.max(-0.6, Math.cos(phi)), a, pos, normal);
    pos.addScaledVector(normal, -0.012);
    q.setFromUnitVectors(up, dir);
    // Roulis : la légère courbure (+x local) penche vers l'extérieur.
    outward.set(Math.cos(a), 0, Math.sin(a)).addScaledVector(dir, -outward.dot(dir)).normalize();
    localX.set(1, 0, 0).applyQuaternion(q);
    const angle = Math.atan2(localX.clone().cross(outward).dot(dir), localX.dot(outward)) + (rand() - 0.5) * 0.6;
    roll.setFromAxisAngle(up, angle);
    q.multiply(roll);
    // Longueurs proches : la coupole a une surface régulière, comme au naturel.
    const len = 0.4 + rand() * 0.06;
    m.compose(pos, q, new THREE.Vector3(1, len, 1));
    florets.setMatrixAt(i, m);
  }
  florets.instanceMatrix.needsUpdate = true;
  return florets;
}

export function createThistle() {
  const thistle = new THREE.Group();
  const rand = seeded(303);

  thistle.add(createHead(), createSpikes(rand), createFlorets(rand));
  return thistle;
}
