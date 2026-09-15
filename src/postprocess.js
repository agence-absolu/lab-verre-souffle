import * as THREE from 'three/webgpu';
import { pass, uniform } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

// Chaîne de post-traitement : rendu de la scène dans une passe, léger bloom
// sur les hautes lumières du verre, puis profondeur de champ dont la mise au
// point suit la caméra (le presse-papier reste net, le sol s'estompe).
// Tone mapping et conversion sRGB restent appliqués en fin de chaîne par le
// RenderPipeline, donc le bloom travaille en HDR linéaire.
export function createPostProcessing(renderer, scene, camera, controls) {
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode();
  const viewZ = scenePass.getViewZNode();

  const bloomPass = bloom(color, 0.3, 0.4, 0.85);

  const focus = {
    distance: uniform(camera.position.distanceTo(controls.target)),
    range: uniform(3), // distance au plan net avant flou complet
    bokeh: uniform(1.5),
  };

  const settings = {
    enabled: true,
    bloom: true,
    dof: true,
    autoFocus: true,
    // Décalage de la mise au point par rapport à la cible : la profondeur vue
    // par l'effet est celle de la surface du dôme, un peu devant son centre.
    focusOffset: -0.4,
  };

  // Le graphe est reconstruit à chaque bascule : un effet coupé ne coûte rien.
  const rebuild = () => {
    let output = color;
    if (settings.bloom) output = output.add(bloomPass);
    if (settings.dof) output = dof(output, viewZ, focus.distance, focus.range, focus.bokeh);
    pipeline.outputNode = output;
    pipeline.needsUpdate = true;
  };
  rebuild();

  const render = () => {
    if (!settings.enabled) {
      renderer.render(scene, camera);
      return;
    }
    if (settings.autoFocus) {
      focus.distance.value = camera.position.distanceTo(controls.target) + settings.focusOffset;
    }
    pipeline.render();
  };

  return { render, rebuild, settings, bloomPass, focus };
}
