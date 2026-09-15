import * as THREE from 'three/webgpu';
import {
  Fn,
  float,
  vec3,
  mix,
  floor,
  fract,
  abs,
  cos,
  atan,
  length,
  hash,
  smoothstep,
  step,
  uniform,
  uv,
  instanceIndex,
  positionGeometry,
} from 'three/tsl';
import { BASE_Y, FRIT_RADIUS, FRIT_HEIGHT, seeded } from './paperweight.js';

// Inclusions classiques des presse-papiers : canes de millefiori posées sur le
// lit de frit, et torsade de latticino autour de la base. Géométries simples,
// tout le dessin est calculé en TSL.

// Palette « cosinus » (Inigo Quilez) : des teintes de verre saturées et
// harmonieuses à partir d'un seul nombre.
const palette = Fn(([t]) => {
  const a = vec3(0.55, 0.45, 0.55);
  const b = vec3(0.45, 0.45, 0.45);
  const d = vec3(0.0, 0.33, 0.67);
  return a.add(b.mul(cos(t.add(d).mul(Math.PI * 2))));
});

// Millefiori : une cane est un motif (anneaux concentriques, contour étoilé)
// étiré le long de son axe — la couleur ne dépend donc que de la position
// radiale dans la section, ce qui habille d'un coup la face et le flanc.
// Chaque instance tire du hasard son nombre d'anneaux, de branches et ses teintes.
export function createMillefiori() {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 24, 1);
  const material = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });

  material.colorNode = Fn(() => {
    const id = float(instanceIndex);
    const seed = hash(id.mul(13.7).add(3.1));
    const seed2 = hash(id.mul(7.3).add(11.9));
    const seed3 = hash(id.mul(3.9).add(27.5));

    // positionGeometry : la position brute du sommet. Sur une InstancedMesh,
    // positionLocal a déjà subi la matrice d'instance.
    const p = positionGeometry.xz;
    const angle = atan(p.y, p.x);
    const points = floor(seed2.mul(4)).add(5); // 5 à 8 branches
    const star = cos(angle.mul(points)).mul(seed3.mul(0.14).add(0.04));
    const r = length(p).mul(float(1).add(star)); // rayon déformé en étoile

    const rings = floor(seed.mul(3)).add(3); // 3 à 5 anneaux
    const k = floor(r.mul(rings)).min(rings);
    const t = fract(r.mul(rings));

    // Teinte de l'anneau ; un anneau sur deux blanc pour les canes « claires ».
    const tint = palette(hash(id.mul(1.7).add(k.mul(0.37))));
    // step(edge, x) en forme fonctionnelle : la forme chaînée inverse les arguments.
    const alternate = step(0.5, hash(id.mul(5.1).add(0.7)));
    const isOdd = step(0.25, fract(k.mul(0.5)));
    let c = mix(tint, vec3(0.95, 0.93, 0.88), alternate.mul(isOdd));
    // Cœur jaune, gaine extérieure claire.
    c = mix(vec3(0.98, 0.85, 0.3), c, step(0.5, k));
    c = mix(c, vec3(0.9, 0.92, 0.95), k.greaterThanEqual(rings).toFloat());
    // Fine ligne sombre entre les anneaux.
    const seam = smoothstep(0.0, 0.08, t).mul(smoothstep(1.0, 0.92, t));
    return c.mul(mix(0.55, 1, seam));
  })();

  // Disposition : une guirlande autour de la fleur, quelques petites canes au centre.
  const specs = [];
  const rand = seeded(101);
  const ringCount = 14;
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2 + (rand() - 0.5) * 0.15;
    specs.push({ r: 0.5 + (rand() - 0.5) * 0.03, a, s: 0.05 + rand() * 0.016 });
  }
  for (let i = 0; i < 6; i++) {
    specs.push({ r: 0.14 + rand() * 0.1, a: rand() * Math.PI * 2, s: 0.03 + rand() * 0.012 });
  }

  const mesh = new THREE.InstancedMesh(geometry, material, specs.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  specs.forEach(({ r, a, s }, i) => {
    const height = s * 1.1;
    pos.set(Math.cos(a) * r, fritTopAt(r) + height * 0.4, Math.sin(a) * r);
    e.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
    q.setFromEuler(e);
    m.compose(pos, q, new THREE.Vector3(s, height, s));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Hauteur du lit de frit (demi-sphère aplatie, voir paperweight.js) au rayon r.
function fritTopAt(r) {
  const x = Math.min(r / FRIT_RADIUS, 1);
  return BASE_Y + 0.012 + FRIT_HEIGHT * Math.sqrt(1 - x * x);
}

// Réglable depuis le panneau : nombre de spires de la torsade sur son tour.
export const torsadeTurns = uniform(36);

// Torsade : anneau de verre pâle où s'enroulent des filaments blancs et un
// filament coloré. uv.x court le long de l'anneau, uv.y autour du boudin :
// un filament est une ligne droite dans cet espace, la torsion vient de uv.x.
export function createTorsade() {
  const geometry = new THREE.TorusGeometry(0.61, 0.03, 24, 240);
  const material = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.15 });

  material.colorNode = Fn(() => {
    const threads = 3;
    const phase = uv().y.mul(threads).add(uv().x.mul(torsadeTurns));
    const line = (offset, width) =>
      smoothstep(width.mul(0.4), width, abs(fract(phase.add(offset)).sub(0.5))).oneMinus();
    const white = line(float(0), float(0.16));
    const colored = line(float(0.5), float(0.09));
    let c = vec3(0.72, 0.8, 0.86); // verre pâle
    c = mix(c, vec3(0.97, 0.96, 0.92), white);
    c = mix(c, vec3(0.85, 0.16, 0.3), colored);
    return c;
  })();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = fritTopAt(0.61) + 0.02; // posée sur la pente du lit, pas enterrée
  return mesh;
}
