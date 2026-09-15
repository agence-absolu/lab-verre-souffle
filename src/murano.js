import * as THREE from 'three/webgpu';
import { Fn, float, vec3, mix, dot, pow, normalView, positionViewDirection, screenUV, viewportSharedTexture } from 'three/tsl';
import { BASE_Y, seeded } from './constants.js';
import { createFritBed, FRIT_PALETTES } from './paperweight.js';

// Presse-papier de Murano des années 1960 : un lit de verre bleu d'où
// s'échappent de grosses bulles en goutte, figées dans leur montée.

const BED_RADIUS = 0.6;
const BED_HEIGHT = 0.16;

function bedTopAt(r) {
  const x = Math.min(r / BED_RADIUS, 1);
  return BASE_Y + 0.012 + BED_HEIGHT * Math.sqrt(1 - x * x);
}

// Goutte : ronde en bas, qui s'effile doucement vers le haut. Profil tourné,
// unité de hauteur 1.
function createTeardropGeometry() {
  const points = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ellipse = Math.sqrt(Math.max(1 - (2 * t - 1) ** 2, 0)) ** 0.9;
    const r = 0.5 * ellipse * (1.15 - 0.45 * t);
    points.push(new THREE.Vector2(Math.max(r, 0), t));
  }
  return new THREE.LatheGeometry(points, 32);
}

// Grosse bulle d'air dans le verre : au centre, l'arrière-plan vu à travers
// une lentille divergente (l'image déjà rendue, décalée selon la normale —
// la technique de l'article Codrops) ; sur le bord, l'anneau clair de la
// réflexion totale ; par-dessus, les reflets de l'environnement du matériau
// physique. Une seule copie d'écran pour toutes les bulles (instances), et le
// dôme, dessiné après, les réfracte à son tour.
function createAirBubbleMaterial() {
  const material = new THREE.MeshPhysicalNodeMaterial({
    roughness: 0.03,
    metalness: 0,
    envMapIntensity: 1.6,
  });
  const facing = dot(normalView, positionViewDirection).clamp(0, 1);
  const rim = pow(float(1).sub(facing), 2.5);
  const refracted = viewportSharedTexture(screenUV.sub(normalView.xy.mul(0.07))).rgb;
  material.colorNode = vec3(0); // pas de diffus : tout passe par l'émissif
  material.emissiveNode = mix(refracted, vec3(0.92, 0.95, 1.0), rim.mul(0.75));
  return material;
}

export function createMuranoBubbles() {
  const group = new THREE.Group();
  const rand = seeded(1960);

  const bed = createFritBed(FRIT_PALETTES.murano);
  bed.scale.set(BED_RADIUS, BED_HEIGHT, BED_RADIUS);
  group.add(bed);

  const count = 16;
  const drops = new THREE.InstancedMesh(createTeardropGeometry(), createAirBubbleMaterial(), count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // Répartition en spirale : régulière sans être alignée.
    const a = i * 2.4 + rand() * 0.4;
    const r = 0.08 + Math.sqrt(i / count) * 0.42;
    const width = 0.1 + rand() * 0.07;
    const height = 0.2 + rand() * 0.3;
    pos.set(Math.cos(a) * r, bedTopAt(r) - 0.03, Math.sin(a) * r);
    e.set((rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12); // très légère inclinaison
    q.setFromEuler(e);
    m.compose(pos, q, new THREE.Vector3(width, height, width));
    drops.setMatrixAt(i, m);
  }
  drops.instanceMatrix.needsUpdate = true;
  group.add(drops);

  return group;
}
