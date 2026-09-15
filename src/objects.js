import { BASE_Y, FOOT_Y } from './constants.js';
import { createFlower } from './flower.js';
import { createThistle, THISTLE_FOOT_Y, THISTLE_TOP_Y } from './thistle.js';
import { createMuranoBubbles } from './murano.js';

// Objets encapsulés. Dans le repère de l'objet : `footY` est la hauteur du
// pied, `wideY` celle de sa plus grande largeur (`reach` = rayon atteint) et
// `topY` son sommet. Ces trois mesures servent à le réduire pour qu'il tienne
// dans la forme de verre choisie sans toucher les parois. `ground` dit si le
// sol générique (frit, millefiori, torsade) l'accompagne par défaut ;
// `floating` autorise à le suspendre à mi-hauteur dans les formes hautes (un
// chardon coulé dans l'acrylique n'a pas les pieds au sol).
export const OBJECTS = {
  flower: { label: 'Fleur', create: createFlower, footY: FOOT_Y, wideY: 0.11, reach: 0.42, topY: 0.4, ground: true },
  thistle: { label: 'Chardon', create: createThistle, footY: THISTLE_FOOT_Y, wideY: 0.11, reach: 0.5, topY: THISTLE_TOP_Y, ground: false, floating: true },
  murano: { label: 'Bulles de Murano', create: createMuranoBubbles, footY: BASE_Y, wideY: BASE_Y + 0.05, reach: 0.62, topY: -0.1, ground: false },
};

// Facteur d'échelle pour que l'objet, pied posé à `footTarget`, reste à
// distance des parois : sa largeur ne dépasse pas la moitié du rayon du verre à
// cette hauteur (la réfraction grossit ce qui s'approche du bord) et son
// sommet reste sous la voûte. La hauteur dépend de l'échelle, d'où quelques
// itérations.
export function fitScale(def, shape, footTarget) {
  let scale = 1;
  for (let i = 0; i < 6; i++) {
    const wideAt = footTarget + (def.wideY - def.footY) * scale;
    const roomWide = (0.5 * shape.radiusAt(Math.min(wideAt, shape.topY - 0.01))) / def.reach;
    const roomTall = (shape.topY - 0.2 - footTarget) / (def.topY - def.footY);
    scale = Math.min(1, roomWide, roomTall);
  }
  return scale;
}

export function disposeObject(object) {
  object.traverse((node) => {
    node.geometry?.dispose();
    node.material?.dispose();
  });
  object.removeFromParent();
}
