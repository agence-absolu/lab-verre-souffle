import GUI from 'lil-gui';
import { glassWobble } from './paperweight.js';
import { petalHue } from './flower.js';
import { torsadeTurns } from './inclusions.js';

// Panneau de réglages (lil-gui), en haut à droite. Il agit directement sur les
// propriétés des matériaux — ce sont déjà des uniformes côté GPU — et sur deux
// uniformes TSL maison (ondulation du verre, teinte des pétales).
export function createPanel({ renderer, controls, dome, bubbles, fritBed, millefiori, torsade, flower, post }) {
  const glass = dome.material;
  const gui = new GUI({ title: 'Réglages', width: 304 });
  if (window.innerWidth <= 720) gui.close();

  const verre = gui.addFolder('Verre');
  verre.add(glass, 'ior', 1, 2.4, 0.01).name('Indice (IOR)');
  verre.add(glass, 'dispersion', 0, 3, 0.05).name('Dispersion');
  verre.add(glass, 'thickness', 0, 2, 0.01).name('Épaisseur');
  verre.add(glass, 'roughness', 0, 0.5, 0.005).name('Rugosité');
  // La Color de three est en linéaire : on passe par un hexa sRGB, lisible dans le sélecteur.
  const tint = { color: `#${glass.attenuationColor.getHexString()}` };
  verre
    .addColor(tint, 'color')
    .name('Teinte')
    .onChange((value) => glass.attenuationColor.set(value));
  verre.add(glass, 'attenuationDistance', 0.2, 10, 0.1).name('Portée de la teinte');
  verre.add(glassWobble, 'value', 0, 0.08, 0.001).name('Ondulation');

  const inclusions = gui.addFolder('Inclusions');
  const petals = { hue: 0 };
  inclusions
    .add(petals, 'hue', -180, 180, 1)
    .name('Teinte pétales (°)')
    .onChange((value) => (petalHue.value = (value * Math.PI) / 180));
  inclusions.add(flower, 'visible').name('Fleur');
  inclusions.add(fritBed, 'visible').name('Lit de frit');
  inclusions.add(millefiori, 'visible').name('Millefiori');
  inclusions.add(torsade, 'visible').name('Torsade');
  inclusions.add(torsadeTurns, 'value', 0, 80, 1).name('Spires de la torsade');
  const air = { count: bubbles.count };
  inclusions
    .add(air, 'count', 0, bubbles.count, 1)
    .name('Bulles')
    .onChange((value) => (bubbles.count = value));

  const traitement = gui.addFolder('Post-traitement');
  traitement.add(post.settings, 'enabled').name('Activer');
  const bloom = traitement.addFolder('Bloom').close();
  bloom.add(post.settings, 'bloom').name('Activer').onChange(post.rebuild);
  bloom.add(post.bloomPass.strength, 'value', 0, 1.5, 0.01).name('Intensité');
  bloom.add(post.bloomPass.radius, 'value', 0, 1, 0.01).name('Rayon');
  bloom.add(post.bloomPass.threshold, 'value', 0, 2, 0.01).name('Seuil');
  const dof = traitement.addFolder('Profondeur de champ').close();
  dof.add(post.settings, 'dof').name('Activer').onChange(post.rebuild);
  dof.add(post.settings, 'autoFocus').name('Suivre la caméra');
  dof.add(post.settings, 'focusOffset', -1.5, 1.5, 0.01).name('Décalage du net');
  dof.add(post.focus.range, 'value', 0.2, 6, 0.05).name('Zone nette');
  dof.add(post.focus.bokeh, 'value', 0, 4, 0.05).name('Bokeh');

  const scene = gui.addFolder('Scène');
  scene.add(renderer, 'toneMappingExposure', 0.3, 2.5, 0.05).name('Exposition');
  scene.add(controls, 'autoRotate').name('Rotation auto');
  scene.add(controls, 'autoRotateSpeed', -3, 3, 0.1).name('Vitesse');

  // reset() rejoue la valeur initiale de chaque contrôleur, onChange compris.
  gui.add({ reset: () => gui.reset() }, 'reset').name('Réinitialiser');

  return gui;
}
