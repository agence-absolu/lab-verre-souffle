import { BASE_Y, FOOT_Y } from './constants.js';
import { createFlower } from './flower.js';
import { createThistle } from './thistle.js';
import { createMuranoBubbles } from './murano.js';

// Objets encapsulés. `footY` est la hauteur du pied dans le repère de l'objet ;
// `ground` dit si le sol générique (frit, millefiori, torsade) l'accompagne par
// défaut ; `fitToBase` met l'objet à l'échelle du méplat quand il est large.
export const OBJECTS = {
  flower: { label: 'Fleur', create: createFlower, footY: FOOT_Y, ground: true, fitToBase: false },
  thistle: { label: 'Chardon', create: createThistle, footY: FOOT_Y, ground: false, fitToBase: false },
  murano: { label: 'Bulles de Murano', create: createMuranoBubbles, footY: BASE_Y, ground: false, fitToBase: true },
};

export function disposeObject(object) {
  object.traverse((node) => {
    node.geometry?.dispose();
    node.material?.dispose();
  });
  object.removeFromParent();
}
