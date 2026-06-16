# PRD 05 — Tooltip de stats d'unité au survol

**Priorité : 2 — Impact ★★ — Effort faible**

## Objectif

Le PRD-04 a retiré le panneau latéral de stats détaillées (jamais lu en
permanence). On rétablit l'accès à ces informations, mais **à la demande** :
survoler une unité du plateau affiche un tooltip avec ses caractéristiques
essentielles. L'information redevient disponible sans encombrer l'écran, et
fonctionne aussi sur les unités ennemies pour aider à planifier ses attaques.

## Existant technique

- `src/App.jsx` `onMouseMove` (lignes ~344-351) : convertit la position souris en
  hex cube via `pixelToHex`, et stocke `hoveredHex` (state, ligne ~126).
  `onMouseLeave` (ligne ~686) remet `hoveredHex` à `null`. La position pixel/écran
  brute du curseur (`clientX/clientY`) n'est **pas** conservée aujourd'hui.
- `hoveredHex` est déjà transmis au rendu (`drawScene(canvas, state, hoveredHex)`)
  pour le surlignage du plateau ; aucun usage HTML/overlay.
- `src/game.js` `handleClick` (ligne ~164) détecte l'unité sous un hex via
  `s.units.find(u => u.currentWounds > 0 && hexKey(u.hex) === k)`. **Aucun helper
  pur dédié** n'existe pour « unité vivante à tel hex » : la logique est inline.
- Données d'unité disponibles (`createUnit`, `src/units.js`) : `name`, `symbol`,
  `player`, `currentWounds`, `wounds`, `movement`, `weaponSkill`,
  `ballisticSkill`, `save`, `hasMoved`, `hasAttacked`, et `weapons[]` avec
  `{ name, type, range, minRange?, attacks, ap, damage }`. Tout est déjà côté
  client (pas de fog of war).
- Couleurs joueurs déjà définies dans `App.jsx` (`P = { 1: "#2a6fa8", 2: "#a03030" }`).
- Le canvas est redimensionnable : `onMouseMove`/`onCanvasClick` appliquent déjà un
  facteur d'échelle `sx/sy` (`CANVAS_W / rect.width`). Pour positionner un overlay,
  on utilisera les coordonnées écran (`clientX/clientY`), pas les coordonnées hex.

## Comportement

1. Au survol d'un hexagone contenant une **unité vivante** (alliée ou ennemie), un
   tooltip apparaît près du curseur.
2. Contenu **condensé** du tooltip :
   - en-tête : `symbol` + `name`, dans la couleur du joueur ;
   - **PV** : `currentWounds/wounds` (vert si > moitié, rouge sinon, comme l'ancien
     panneau) ;
   - **MVT** (`movement`) et **SVG** (`save+`) ;
   - une ligne compacte par arme : `name` (tir/mêlée) · portée
     (`minRange?-`)`range` · DGT (`damage`). Le détail ATQ/PA n'est pas affiché.
3. Le tooltip suit le curseur (overlay HTML positionné via `clientX/clientY`, avec
   un léger décalage pour ne pas masquer l'hex). Apparition immédiate.
4. Le tooltip disparaît dès que le curseur quitte une unité ou sort du canvas
   (`onMouseLeave`).
5. S'applique **uniquement aux unités** (pas aux hexagones de terrain) et
   uniquement sur le plateau de jeu (pas en phase de préparation).
6. Purement informatif : aucun effet sur l'état de jeu, la sélection ou les
   actions ; n'interfère pas avec le clic de sélection existant.

## Hors-scope

- **Support tactile / mobile** : pas de gestion du survol au toucher (appui long…) ;
  tooltip pensé pour la souris.
- **Réintroduction d'un panneau permanent** : on ne rétablit pas le bloc latéral
  retiré au PRD-04 ; l'information passe seulement par le tooltip.
- **Brouillard de guerre / vision limitée** : aucune visibilité partielle ; les
  stats ennemies sont pleinement affichées.
- **Tooltip sur les terrains** : les infobulles d'hexagones de terrain ne sont pas
  couvertes ici (PRD ultérieur éventuel).
- **Détail complet des armes** (ATQ, PA) : volontairement omis pour rester
  condensé ; reste consultable dans le modal de combat.

## Impacts par couche

- `src/game.js` : ajout d'un helper pur exporté `unitAt(units, hex)` renvoyant
  l'unité vivante sur l'hex ou `null` ; réutilisé dans `handleClick` à la place du
  `find` inline (DRY).
- `src/App.jsx` :
  - `onMouseMove` conserve aussi la position écran du curseur (nouveau state, ex.
    `tooltipPos { x, y }`) ; `onMouseLeave` la remet à `null` ;
  - dérivation de l'unité survolée via `unitAt(state.units, hoveredHex)` ;
  - rendu d'un overlay tooltip (HTML, `position: fixed`) quand une unité est
    survolée, dans le thème clair existant.
- `src/styles.css` : styles du tooltip (fond clair, bordure `#c8b898`, ombre
  légère), cohérents avec le thème.

## Critères d'acceptation

- Survoler une de ses unités affiche le tooltip condensé (nom, PV colorés, MVT,
  SVG, lignes d'armes portée/DGT).
- Survoler une unité ennemie affiche le même tooltip.
- Survoler un hexagone vide ou de terrain n'affiche aucun tooltip.
- Le tooltip suit le curseur et disparaît à la sortie de l'unité / du canvas.
- Le tooltip n'altère ni la sélection, ni les actions, ni le déroulé d'une partie
  (clic de sélection inchangé).
- `unitAt(units, hex)` renvoie l'unité vivante attendue, et `null` sur un hex vide
  ou occupé par une unité morte (`currentWounds <= 0`).

## Tests

- `tests/game.test.js` :
  - `unitAt` renvoie l'unité présente sur un hex donné ;
  - `unitAt` renvoie `null` sur un hex vide ;
  - `unitAt` ignore une unité morte (`currentWounds <= 0`) ;
  - `handleClick` conserve son comportement après extraction du helper (cas de
    sélection déjà couverts).
- Le rendu du tooltip (overlay JSX/CSS) relève du visuel : à valider via
  `npx vite`, conformément à la philosophie « tests macro » du projet.

## Risques / questions ouvertes

- **Délai d'apparition** : apparition immédiate retenue ; à l'usage, un léger délai
  (~300-400 ms) pourrait réduire le « clignotement » au déplacement de la souris —
  réglage à décider à l'essai.
- **Positionnement en bord d'écran** : prévoir un éventuel ajustement si le tooltip
  déborde (inverser le décalage) — à affiner visuellement.
- **Redondance d'info ennemie** : afficher les stats ennemies complètes facilite le
  jeu mais retire toute incertitude ; assumé ici (pas de brouillard de guerre).
