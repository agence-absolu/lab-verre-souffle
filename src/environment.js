import * as THREE from 'three/webgpu';
import { Fn, float, vec3, mix, smoothstep, length, positionWorld, color } from 'three/tsl';

// Fond de la scène : repris tel quel au bord du sol pour que l'horizon se fonde.
export const BACKGROUND = 0x111114;

// Studio virtuel : une pièce sombre et quelques panneaux lumineux (softbox
// au plafond, bande froide à gauche, touche chaude à droite). Converti en
// carte d'environnement préfiltrée, c'est lui qui donne au verre ses reflets
// et ses transitions de Fresnel — aucune lumière classique n'est nécessaire.
function createStudioScene() {
  const scene = new THREE.Scene();

  const room = new THREE.Mesh(
    new THREE.BoxGeometry(14, 8, 14),
    new THREE.MeshBasicMaterial({ color: 0x2a2a32, side: THREE.BackSide }),
  );
  scene.add(room);

  const panel = (w, h, col, intensity, position, lookAt) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    mesh.position.copy(position);
    mesh.lookAt(lookAt);
    scene.add(mesh);
  };

  const center = new THREE.Vector3(0, 0, 0);
  panel(5, 3, 0xfff4e6, 5, new THREE.Vector3(1.5, 3.8, 1.5), center); // softbox principale
  panel(1.2, 6, 0xdbe8ff, 4, new THREE.Vector3(-6, 1.5, -1), center); // bande froide
  panel(2, 2, 0xffd9b3, 4, new THREE.Vector3(5.5, 0.5, -3), center); // touche chaude
  panel(6, 1, 0xffffff, 2.5, new THREE.Vector3(0, -0.5, 6.5), center); // léger fill de face
  panel(10, 5, 0x9aa0b4, 0.9, new THREE.Vector3(0, 1.5, -6.8), center); // fond doux derrière, pour des dégradés
  panel(8, 8, 0x0b0b10, 1, new THREE.Vector3(0, -3.9, 0), new THREE.Vector3(0, 0, 0)); // sol sombre

  return scene;
}

export function createEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = createStudioScene();
  const envMap = pmrem.fromScene(studio, 0.02).texture;
  pmrem.dispose();

  scene.environment = envMap;
  scene.environmentIntensity = 1;
  scene.background = new THREE.Color(BACKGROUND);

  // Sol : un grand disque dont la couleur est entièrement calculée en TSL —
  // ombre de contact sous le presse-papier, lueur caustique au centre, puis
  // vignettage vers la couleur de fond. Opaque : pas de tri à gérer avec le verre.
  const floorMaterial = new THREE.MeshBasicNodeMaterial();
  floorMaterial.colorNode = Fn(() => {
    const d = length(positionWorld.xz);
    const base = color(0x1a1a20);
    const bg = color(BACKGROUND);
    // Ombre douce, un peu décalée vers l'arrière (la softbox est devant/dessus).
    const shadow = smoothstep(0.35, 1.25, length(positionWorld.xz.sub(vec3(0.1, 0, -0.15).xz)));
    // Point lumineux concentré par le verre.
    const caustic = float(1).sub(smoothstep(0.0, 0.32, d)).mul(0.35);
    const lit = mix(base.mul(0.35), base, shadow).add(vec3(1.0, 0.95, 0.85).mul(caustic));
    return mix(lit, bg, smoothstep(2.5, 9, d));
  })();

  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.7;
  scene.add(floor);

  // Un léger directionnel pour souligner le relief des pétales ; l'environnement
  // fait l'essentiel.
  const key = new THREE.DirectionalLight(0xfff1e0, 0.5);
  key.position.set(1.5, 3, 2);
  scene.add(key);

  return { floor, envMap };
}
