import * as THREE from 'three/webgpu';
import { RADIUS, BASE_Y } from './constants.js';

// Formes de verre. Chacune se réduit à une fonction rayon(y) entre son méplat
// et son sommet : le profil tourné, le chanfrein, le rayon de la base et la
// zone où semer les bulles s'en déduisent. Ajouter une forme = ajouter une entrée.
export const GLASS_SHAPES = {
  dome: {
    label: 'Dôme',
    baseY: BASE_Y,
    topY: RADIUS,
    radiusAt: (y) => Math.sqrt(Math.max(RADIUS * RADIUS - y * y, 0)),
  },
  sphere: {
    label: 'Sphère',
    baseY: -0.94, // juste un petit méplat pour tenir debout
    topY: RADIUS,
    radiusAt: (y) => Math.sqrt(Math.max(RADIUS * RADIUS - y * y, 0)),
  },
  egg: {
    label: 'Œuf',
    baseY: BASE_Y,
    topY: 1.05,
    // Ovoïde : ellipse dont la largeur diminue vers le haut (pointe) et
    // s'arrondit vers le bas, proportions d'un œuf Daum (h ≈ 1,4 × l).
    radiusAt: (y) => {
      const u = THREE.MathUtils.clamp((y - 0.1) / 0.95, -1, 1);
      return 0.62 * Math.sqrt(1 - u * u) * (1 - 0.22 * u);
    },
  },
  pebble: {
    label: 'Galet',
    baseY: BASE_Y,
    topY: 0.85,
    // Sphère aplatie, façon Murano.
    radiusAt: (y) => {
      const u = THREE.MathUtils.clamp(y / 0.85, -1, 1);
      return 1.0 * Math.sqrt(1 - u * u);
    },
  },
};

for (const shape of Object.values(GLASS_SHAPES)) {
  shape.baseRadius = shape.radiusAt(shape.baseY);
  shape.centerY = (shape.baseY + shape.topY) / 2;
}

// Profil tourné : disque de base, petit chanfrein poli, puis la courbe
// rayon(y) jusqu'au sommet, échantillonnée plus finement vers le haut où la
// courbure se resserre.
export function createGlassGeometry(shape) {
  const { baseY, topY, radiusAt, baseRadius } = shape;
  const chamfer = Math.min(0.05, baseRadius * 0.15);
  const points = [new THREE.Vector2(0, baseY), new THREE.Vector2(baseRadius - chamfer, baseY)];

  const steps = 128;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const eased = 1 - (1 - t) * (1 - t); // plus de points vers le sommet
    const y = baseY + chamfer + eased * (topY - baseY - chamfer);
    points.push(new THREE.Vector2(Math.max(radiusAt(y), 0.0005), y));
  }
  points[points.length - 1].x = 0;

  return new THREE.LatheGeometry(points, 192);
}

// Le point est-il dans la coque du verre (assez loin de l'axe pour ne pas
// gêner l'objet, assez loin de la surface pour ne pas la percer) ?
export function inShell(shape, p) {
  if (p.y < shape.baseY + 0.12 || p.y > shape.topY - 0.06) return false;
  const q = Math.hypot(p.x, p.z) / shape.radiusAt(p.y);
  const nearTop = p.y > shape.topY - 0.35;
  return q < 0.9 && (q > 0.55 || nearTop);
}
