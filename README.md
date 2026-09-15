# Presse-papier en verre soufflé

Presse-papier en verre soufflé — démonstration technique du lab Absolu.

Démo du lab Absolu, publiée sur **https://lab.agence-absolu.com/verre-souffle/**.

Inspirée de [Building an Infinite Liquid Glass Grid with Three.js WebGPU and TSL](https://tympanus.net/codrops/2026/09/08/building-an-infinite-liquid-glass-grid-with-three-js-webgpu-and-tsl/)
(Codrops) : même socle — `WebGPURenderer` et matériaux écrits en TSL, repli
automatique sur WebGL 2 — appliqué à un vrai volume de verre plutôt qu'à des
tuiles plates.

## Ce qui est rendu

- **Le dôme** (`src/paperweight.js`) : profil tourné (méplat, chanfrein, arc de
  sphère) et `MeshPhysicalNodeMaterial` — transmission, épaisseur, IOR 1,52,
  dispersion chromatique, atténuation légèrement bleutée. Un `normalNode` TSL
  ondule imperceptiblement la normale : le verre est soufflé à la main, pas
  usiné.
- **Les inclusions** (`src/inclusions.js` et `paperweight.js`) : bulles d'air
  en instances (rim clair en TSL), lit de verre broyé multicolore dont chaque
  cellule tire sa couleur d'un `hash`, guirlande de **millefiori** — canes
  instanciées dont le motif (anneaux concentriques, contour étoilé, palette
  cosinus) est une fonction de la section, donc étiré le long de l'axe comme
  une vraie cane — et **torsade de latticino**, anneau dont les filaments
  sont des droites dans l'espace UV du tore.
- **La fleur** (`src/flower.js`) : pétales et feuilles en `ParametricGeometry`,
  tige en `TubeGeometry`, étamines instanciées. Dégradés, nervures et
  piquetage calculés en TSL, palette en sRGB via `color()`.
- **Le studio** (`src/environment.js`) : une pièce sombre et quelques panneaux
  lumineux passés au `PMREMGenerator` font toute la lumière ; le sol calcule
  ombre de contact, caustique et vignettage dans son `colorNode`.

- **Le post-traitement** (`src/postprocess.js`) : `RenderPipeline` et une
  passe de scène, léger bloom sur les hautes lumières (`bloom`), puis
  profondeur de champ (`dof`) dont la mise au point suit la caméra. Le graphe
  est reconstruit quand on coupe un effet : rien n'est calculé pour rien.
- **Le panneau** (`src/panel.js`) : lil-gui, en haut à droite — IOR,
  dispersion, épaisseur, rugosité, teinte du verre, ondulation, teinte des
  pétales, inclusions, bloom, profondeur de champ, exposition et rotation. Les propriétés des matériaux
  sont déjà des uniformes ; l'ondulation et la teinte passent par des
  `uniform()` TSL.

`?webgl` dans l'URL force le repli WebGL 2 pour comparer les deux backends.

## Développement

```bash
npm install
npm run dev       # http://localhost:5173/verre-souffle/
npm run build     # compile dans dist/
npm run preview   # prévisualise dist/ sur le même sous-chemin
```

Le site est servi depuis un sous-répertoire du lab : `vite.config.js` déduit la
base des chemins du nom npm (`verre-souffle`). `BASE_PATH=/ npm run build` pour une
racine de domaine.

## Publication

`.github/workflows/deploy.yml` compile et envoie `dist/` par rsync sur SSH dans
`lab.agence-absolu.com/lab-projects/verre-souffle/` à chaque push sur `main` — ou à
la demande, onglet Actions. Le hub sert ce dossier sur `/verre-souffle/` sans
aucune configuration de son côté.

### 1. Le dépôt

```bash
gh repo create agence-absolu/lab-verre-souffle --public --source=. --push
```

**Public, obligatoirement** : les secrets SSH sont définis au niveau de
l'organisation `agence-absolu`, et GitHub ne les partage qu'avec les dépôts
publics (limite du plan gratuit). Un dépôt privé verrait son workflow échouer
faute de secrets.

### 2. Les secrets

Rien à créer dans le dépôt : le workflow lit ceux de l'organisation
(Settings de l'organisation › Secrets and variables › Actions).

| Secret | Contenu |
| --- | --- |
| `LAB_SSH_HOST` | hôte SSH Infomaniak (`…ssh.hosting-ik.com`) |
| `LAB_SSH_USER` | compte SSH |
| `LAB_SSH_PASSWORD` | mot de passe |
| `LAB_SSH_KNOWN_HOSTS` | facultatif — sortie de `ssh-keyscan <hôte>`, pour épingler l'empreinte du serveur |

Sans le dernier, le workflow relève l'empreinte du serveur au premier contact
et la croit sur parole. Un secret de dépôt du même nom, s'il en existe un,
prime sur celui de l'organisation.

Pourquoi un mot de passe et pas une clé : chez Infomaniak, l'authentification
par clé n'est pas disponible sur un site Node.js et le port FTP est filtré.

### 3. Pousser

Premier push sur `main` : le workflow compile, envoie, et la démo apparaît sur
la page d'accueil du lab.

## Règles du hub

- le slug (`"name"` de `package.json`) est en minuscules : lettres, chiffres,
  tirets ;
- `index.html` est revalidé à chaque visite, le reste est mis en cache un an —
  les bundles portent une empreinte dans leur nom (Vite le fait) ;
- une URL sans extension qui ne correspond à aucun fichier retombe sur
  `index.html` (routage côté client).
