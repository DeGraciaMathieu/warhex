# PRD 01 — Animation de déplacement d'unité

**Priorité : 1 — Impact ★★★ — Effort moyen**

## Objectif

Donner du poids et de la lisibilité au déplacement : aujourd'hui une unité
validée **téléporte** instantanément à destination. On perd l'information
tactique de *d'où* elle vient et *par où* elle passe, et le geste de jeu manque
de feedback. Animer le trajet ancre l'action dans l'espace et rend le plateau
vivant — y compris pour lire les manœuvres de l'IA.

## Existant technique

- Le déplacement est **instantané** : `handleClick` (`game.js:146`) applique
  `applyArrivalEffects` puis fixe directement `selectedUnit.hex` à la case
  cliquée. Aucun état intermédiaire.
- `validMoves` est une **liste plate de cases atteignables** (`reachableHexes`,
  `hex.js:80`), pas un chemin. `pathDistance` (`hex.js:51`) calcule un coût mais
  **ne renvoie aucun trajet** : aucune des deux fonctions ne conserve de
  `cameFrom`. → reconstruire le chemin origine→destination est un prérequis.
- Le coût de mouvement n'est pas uniforme : terrain à coût 2 (`costKeys`), cases
  bloquantes (`obstacleKeys`), cases d'arrêt (`stopKeys`). Le chemin animé doit
  refléter le trajet réellement emprunté.
- Système d'animation **déjà en place et réutilisable** : `dyingUnits` /
  `hitEffects` / `attackEffects` portent chacun un `time` + une durée
  (`DEATH_ANIM_DURATION`, `HIT_EFFECT_DURATION`, `ATTACK_EFFECT_DURATION` dans
  `renderer.js`), animés par une boucle `requestAnimationFrame`
  (`App.jsx:237-258`) qui purge l'effet via `setState` à la fin.
- Les unités sont dessinées à `hexToPixel(unit.hex.q, unit.hex.r)`
  (`renderer.js:138`) — point d'injection naturel d'une position interpolée.
- L'IA passe par le **même `handleClick`** (`App.jsx:304`) : animer dans le
  moteur couvre joueur + IA sans code séparé.
- Les blocages d'entrée existent déjà comme motif : `onCanvasClick` /
  `selectWeapon` ignorent les clics pendant `diceAnim` non terminé
  (`App.jsx:315`).

## Comportement

1. **Reconstruction du chemin** : à la validation d'un déplacement, calculer la
   suite ordonnée de cases (origine incluse → destination) effectivement
   empruntée, en respectant coûts/obstacles. Stocker ce chemin dans un nouvel
   effet d'état (ex. `movingUnit: { id, path, time }`).
2. **Interpolation case par case** : le rendu déplace l'unité le long du chemin,
   segment par segment, à vitesse constante. Durée totale ≈ proportionnelle au
   nombre de cases (nouvelle constante `MOVE_ANIM_PER_HEX`, ex. 120 ms/case),
   plafonnée pour rester réactive.
3. **Périmètre joueur + IA** : tout déplacement validé via `handleClick` est
   animé, qu'il soit déclenché par le joueur ou par l'IA.
4. **Blocage des entrées** : pendant l'animation, clics et raccourcis sont
   ignorés (même motif que `diceAnim`) ; à la fin, l'effet est purgé et l'état
   logique (déjà à destination) reprend la main.

## Hors-scope

- Animation des **autres transitions** (mort, dégâts, tir) : déjà couvertes par
  les effets existants, non modifiées.
- Animation de la **consolidation** post-mêlée (`computeConsolidate`) :
  déplacement d'un type différent, PRD séparé si souhaité.
- **Easing / accélération-décélération**, rotation de l'unité dans le sens du
  déplacement, traînée : polish cosmétique repoussé.
- Synchronisation fine de l'animation en **multijoueur en ligne** au-delà de ce
  que `applyAction` / `sendMsg` propage déjà.

## Impacts par couche

- `hex.js` : nouvelle fonction de reconstruction de chemin (BFS/Dijkstra avec
  `cameFrom`), ou extension de `pathDistance` pour renvoyer le trajet.
- `game.js` : `handleClick` (branche move) renseigne `movingUnit` (chemin +
  `time`) avant de poser l'état à destination.
- `units.js` : initialiser le nouveau champ d'état (`movingUnit: null`) dans
  `initState()`.
- `renderer.js` : nouvelle constante `MOVE_ANIM_PER_HEX` ; `drawScene` interpole
  la position de l'unité en cours de déplacement le long de son chemin.
- `App.jsx` : étendre la boucle `requestAnimationFrame` (`237-258`) pour piloter
  et purger `movingUnit` ; étendre les gardes d'entrée (`onCanvasClick`, etc.)
  pour bloquer pendant l'animation.

## Critères d'acceptation

- Un déplacement validé montre l'unité parcourir visiblement chaque case du
  trajet réellement emprunté (pas une ligne droite à travers obstacles).
- Les déplacements de l'IA sont animés à l'identique.
- Pendant l'animation, aucun clic ni raccourci n'altère l'état ; l'animation
  terminée, l'unité est exactement à la case de destination et l'effet est purgé.
- L'animation n'altère **pas** l'état logique : le résultat final (position,
  `hasMoved`, cibles valides, fin d'activation) est identique à aujourd'hui.
- Un déplacement d'1 case et un déplacement long ont des durées cohérentes
  (proportionnelles, plafonnées).

## Tests

- `hex.test.js` : la reconstruction de chemin renvoie une suite contiguë de
  cases valides de l'origine à la destination, respectant obstacles et coûts
  (pas de traversée d'obstacle, longueur ≤ mouvement).
- `game.test.js` : après un déplacement, `movingUnit` contient le chemin attendu
  **et** l'état logique (position finale, `hasMoved`, fin d'activation) est
  inchangé par rapport au comportement actuel.

## Risques / questions ouvertes

- **Reconstruction de chemin ambiguë** : plusieurs trajets de même coût peuvent
  mener à destination. Choisir un déterminisme stable (ordre des voisins) pour
  éviter des trajets erratiques ; à valider visuellement.
- **Réactivité vs lisibilité** : trop lent agace en partie longue (surtout pour
  l'IA qui enchaîne). Régler `MOVE_ANIM_PER_HEX` et le plafond après essai en jeu.
- **Multijoueur** : vérifier que l'animation déclenchée à partir de l'état reçu
  (`applyOnlineMessage`) joue correctement chez l'adversaire, sans rejouer ni
  désynchroniser.
- **Enchaînement IA** : la boucle IA (`App.jsx:289-310`) ne doit pas lancer
  l'action suivante avant la fin de l'animation de déplacement (ajouter la garde,
  comme pour `diceAnim`).
