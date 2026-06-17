# PRD 12 — Feedback de survol du terrain

**Priorité : 1 — Impact ★★★ — Effort moyen**

## Objectif

En déplaçant la souris sur le plateau, le seul retour visuel actuel est le tooltip d'unité :
survoler une case de terrain (vide, forêt, colline…) ne produit rien. La grille paraît inerte
et le joueur ne « sent » pas le terrain ni ses effets. On veut un feedback de survol immédiat et
lisible — une mise en relief de la case sous le curseur + une infobulle décrivant le terrain —
pour rendre le plateau tangible et faire comprendre les effets de chaque case sans clic.

## Existant technique

- `App.jsx` : `hoveredHex` (état) est mis à jour dans `onMouseMove` (l.395) et remis à `null`
  sur `onMouseLeave`. Le canvas est redessiné à chaque changement de `hoveredHex`
  (`useEffect` l.216-217), donc l'infrastructure de survol/redraw existe déjà — un highlight de
  case ne coûte qu'un rendu supplémentaire.
- `renderer.js` (`drawScene`, l.37) : reçoit `hoveredHex` et calcule `isHover` (l.77), mais ne
  l'utilise **que** pour assombrir le remplissage des cases de déplacement/cible (l.95-96).
  Une case de terrain « brute » survolée n'a aucun rendu distinct.
- `game.js` : `getUnitTerrainEffects(unit, state)` (l.5) renvoie les effets d'une **unité posée**
  (icônes cover/river/hill). Il n'existe **aucun** descripteur pur « terrain d'une case → nom +
  effets » réutilisable pour une case quelconque (avec ou sans unité).
- Sets de terrain disponibles dans le state : `obstacles`, `rivers`, `towns`, `forests`,
  `hills`, `swamps` (cf. `initState`). Les règles de chaque terrain (mvt/LOS/combat) sont déjà
  centralisées : `buildTerrainKeys` (coût/stop/obstacle), `buildLosKeys` (blocage LOS),
  `getSaveModifier`/`getRangeModifier` (combat) — sources de vérité pour rédiger les libellés.
- `App.jsx` possède déjà un patron d'**infobulle différée** : `tooltipPos`, `tooltipUnitId`,
  `TOOLTIP_DELAY` et le composant `.unit-tooltip` (l.896+), réutilisable pour le terrain.
- Le curseur épée custom (PRD 11) occupe déjà le coin du pointeur : l'infobulle devra être
  décalée pour ne pas être masquée (le tooltip d'unité est déjà décalé de `+16 px`).

## Comportement

1. **Surbrillance « relief » de la case survolée**, sur **toute** case (terrain vide inclus) :
   la case sous le curseur ressort via un effet de relief (ombre portée douce + léger
   éclaircissement du remplissage + liseré renforcé). Effet purement visuel, aucun impact règle.
2. La géométrie de l'hexagone **ne se déplace pas** (pas de décalage de position) : le relief est
   simulé par ombre/contraste pour ne pas désaligner l'unité ou les icônes posées sur la case.
3. **Infobulle de terrain** affichée au survol, décrivant la case : nom + icône + effets
   concrets (coût de mouvement, arrêt à l'entrée, blocage LOS, bonus couvert, portée, poison…).
   Exemple forêt : « 🌲 Forêt — Mvt 2 PM · Couvert −1 svg · Bloque la LOS ».
4. Le contenu de l'infobulle est dérivé d'une **fonction pure** `describeTerrain(hex, state)`
   renvoyant `{ type, label, icon, effects: [string] }`, ou un descripteur « Plaine » (terrain
   dégagé, sans effet) pour une case vide. Aucune logique d'effet réécrite : les libellés
   reflètent les règles existantes.
5. **Anti-surcharge** : l'infobulle n'apparaît qu'après un court délai d'intention
   (réutilisation de `TOOLTIP_DELAY`), reste compacte, et se masque dès que le curseur quitte la
   case ou le plateau.
6. **Priorité d'infobulle** : si la case contient une unité, le **tooltip d'unité existant**
   prime ; l'infobulle de terrain ne s'affiche que sur une case sans unité. Jamais les deux
   simultanément.
7. La surbrillance de relief reste **compatible** avec les surlignages existants (déplacement
   bleu, cible rouge, anneau pulsé PRD 11) : elle s'ajoute sans les masquer.

## Hors-scope

- Affichage des coûts de chemin cumulés / portée de déplacement au survol (relève d'un PRD
  mouvement dédié).
- Prévisualisation de ligne de vue ou de jets de combat au survol.
- Mise en relief permanente de tous les terrains hors survol (resterait du ressort du rendu de
  base de chaque terrain, déjà en place).
- Sons / retours haptiques.

## Impacts par couche

- `src/game.js` : nouvelle fonction pure exportée `describeTerrain(hex, state)` →
  `{ type, label, icon, effects }` (ou descripteur « Plaine »), construite à partir des sets de
  terrain et des règles déjà centralisées. Aucune logique de jeu modifiée.
- `src/renderer.js` : dans `drawScene`, dessiner l'effet de relief sur la case `isHover` (ombre
  portée + éclaircissement + liseré renforcé), sans déplacer la géométrie, en préservant les
  fills de déplacement/cible.
- `src/App.jsx` : état + rendu d'une infobulle de terrain calquée sur le tooltip d'unité
  (`tooltipPos`, délai `TOOLTIP_DELAY`), affichée uniquement si `hoveredHex` ne porte pas
  d'unité ; alimentée par `describeTerrain`. Décalage pour éviter le curseur épée.
- `src/styles.css` : classe d'infobulle de terrain (peut réutiliser/étendre `.unit-tooltip`).

## Critères d'acceptation

- Survoler n'importe quelle case du plateau (vide ou non) met cette case en relief de façon
  visible et immédiate ; le relief disparaît dès que le curseur change de case ou quitte le
  plateau.
- Survoler une case de terrain spécial affiche, après le court délai, une infobulle nommant le
  terrain et listant ses effets réels (cohérents avec les règles de mouvement/LOS/combat).
- Survoler une case vide affiche une infobulle « Plaine » minimale (ou son équivalent) sans effet.
- Sur une case occupée par une unité, c'est le tooltip d'unité qui s'affiche, pas l'infobulle de
  terrain ; les deux ne coexistent jamais.
- La surbrillance n'écrase pas les surlignages de déplacement/cible/anneau de cible.
- `describeTerrain` est déterministe et pure (mêmes entrées → même sortie, sans React).

## Tests

- `tests/terrain.test.js` : `describeTerrain(hex, state)` renvoie le bon `type`/`label`/`effects`
  pour chaque type de terrain (obstacle, rivière, ville, forêt, colline, marais) et le descripteur
  « Plaine » pour une case vide ; vérifier que les effets listés correspondent aux règles
  (ex. forêt → coût 2 + couvert + blocage LOS ; colline → coût 2 + portée +1 ; rivière → arrêt).
- Le rendu (relief) et l'infobulle React restent visuels : non couverts par des tests unitaires
  (pas de harness DOM dans le projet) — vérification en jeu.

## Risques / questions ouvertes

- **Surcharge visuelle** (signalée) : équilibrer l'intensité du relief et la fréquence
  d'apparition de l'infobulle (délai, compacité) pour ne pas parasiter la lecture du plateau ;
  à régler après essai.
- **Effet de relief en canvas** : une vraie surélévation géométrique désaligne le contenu de la
  case — d'où le choix ombre/contraste sans déplacement ; reste à valider que le rendu « ressort »
  suffisamment sans bouger l'hexagone.
- **Lisibilité de l'infobulle** près du curseur épée et des bords du canvas (repositionnement
  éventuel si l'infobulle déborde).
- Cohérence des libellés d'effets avec d'éventuelles évolutions de règles : `describeTerrain` doit
  rester la seule source d'affichage pour éviter la divergence.
