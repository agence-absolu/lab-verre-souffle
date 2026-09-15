// Repères communs à toutes les pièces du presse-papier.

export const RADIUS = 1; // rayon du dôme de référence
export const BASE_Y = -0.7; // méplat du dôme de référence : les inclusions sont construites pour lui
export const FRIT_RADIUS = 0.66; // rayon du lit de frit (le méplat fait ~0,71)
export const FRIT_HEIGHT = 0.11;
export const FOOT_Y = -0.66; // pied des objets encapsulés, planté dans le lit de frit

// Petit générateur déterministe (mulberry32) : la disposition des inclusions
// est la même à chaque chargement.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
