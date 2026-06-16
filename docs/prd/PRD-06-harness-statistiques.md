# PRD 06 — Harness de simulation statistique

**Priorité : 2 — Impact ★★ — Effort moyen**

## Objectif

Permettre d'équilibrer le jeu sur des bases chiffrées plutôt qu'au ressenti. Le
harness joue automatiquement un grand nombre de parties IA contre IA en faisant
varier des profils (compositions d'armée, densité de terrain, poids de décision
de l'IA), puis agrège les résultats (taux de victoire, efficacité par unité,
influence du terrain) pour repérer les déséquilibres. Contrainte forte : le
développement du harness ne doit avoir **aucun impact sur le comportement du
jeu**.

## Existant technique

- Le moteur est déjà entièrement pilotable sans React (« headless ») :
  `computeAIAction(state)` retourne une action `{ type, hex|weapon|accept }`,
  appliquée via les fonctions pures `handleClick`, `computeWeaponSelect` +
  `applyDamage`, `computeConsolidate`, `computeEndTurn` (`src/game.js`).
- `src/App.jsx` est le seul orchestrateur (timers, animations dés/déplacement,
  `aiPreview`). Rien de cette couche n'est nécessaire à la simulation : la
  boucle peut être reproduite sans délais ni animations.
- `initState(armies, options)` (`src/units.js`) accepte déjà des armées
  arbitraires et des options de terrain (`terrainDensity`, presets via
  `TERRAIN_PRESETS`, `generateTerrain`). Tout est paramétrable sans modification.
- Parties bornées : `checkWinner(scores, round)` ne tranche qu'à partir du
  round 7 → terminaison garantie, pas de boucle infinie possible côté rounds.
- **Aucun RNG seedable** : `rollD6` (`src/combat.js`) et la génération de terrain
  (`src/units.js`) appellent `Math.random` directement. Choix retenu :
  **agrégation pure** sur un grand N, sans toucher au RNG → parties non
  reproductibles individuellement mais statistiquement lissées. Aucune modif de
  `combat.js`/`units.js`.
- **IA câblée pour le joueur 2** : `src/ai.js` filtre en dur `u.player === 2`
  (ses unités) et `u.player === 1` (ennemis). Les poids de décision (100, 50,
  20, 10, 5) sont des constantes en dur dans `pickBestUnit`. Pour faire jouer
  l'IA des deux côtés sans modifier `ai.js`, le harness utilise un **adaptateur
  de perspective** (cf. Comportement). Pour faire varier les poids, `ai.js`
  reçoit un paramètre optionnel rétro-compatible.

## Comportement

1. Le harness vit dans un répertoire isolé `harness/` (hors `src/`), lancé par
   `node harness/run.js`. Il n'est jamais importé par le jeu.
2. Un **profil** est un objet décrivant une partie à simuler :
   `{ armies: { 1: [...], 2: [...] }, terrainDensity|preset, weights: { 1, 2 } }`.
   Le harness lit une liste de profils (ou de matchups profil A vs profil B) et,
   pour chacun, lance **N parties** (N configurable, défaut à fixer, ex. 500).
3. Boucle d'une partie (sans animation, sans timer) :
   - `initState(armies, options)` pour l'état initial.
   - Tant que `state.winner` est nul : obtenir l'action IA du joueur courant,
     l'appliquer via les fonctions pures de `src/game.js`, jusqu'à
     `computeEndTurn`. La résolution d'attaque enchaîne `computeWeaponSelect`
     puis `applyDamage` directement (pas d'animation de dés).
   - Garde-fou : plafond de tours par partie (ex. 50 activations) pour couper
     toute boucle pathologique, comptée comme partie « avortée » dans les stats.
4. **Adaptateur de perspective** (côté harness, aucune modif de `ai.js`) : quand
   `currentPlayer === 1`, le harness construit une vue de l'état où les labels
   de joueur sont permutés (unités `player` 1↔2, `townOwnership`, `currentPlayer`),
   appelle `computeAIAction`, puis applique l'action retournée (référencée par
   `hex`/`weapon`, en coordonnées absolues) sur l'état **réel** non permuté.
   `ai.js` reste inchangé et continue de « croire » qu'il joue le joueur 2.
5. **Poids d'IA paramétrables** (seule modification du code jeu, additive et
   inerte par défaut) : `computeAIAction(state, weights?)` accepte un objet de
   poids optionnel transmis à `pickBestUnit`. Les valeurs par défaut sont
   **exactement** les constantes actuelles (100/50/20/10/5) → sans argument, le
   comportement du jeu est strictement identique à aujourd'hui.
6. Statistiques agrégées et affichées en fin de run (tableau console) :
   - **Taux de victoire** : % victoires J1 / J2 / nuls par profil ou matchup.
   - **Efficacité par unité** : par type d'unité (warrior/knight/sniper/
     berserker), taux de survie en fin de partie et kills attribués (best
     effort, par observation de l'état entre actions).
   - **Influence du terrain / score** : écart de score moyen, nombre de villes
     contrôlées en moyenne, comparaison entre presets/densités de terrain.
7. Sortie : tableau récapitulatif lisible en console (une ligne par profil/
   matchup, colonnes des métriques ci-dessus) + total de parties et parties
   avortées.

## Hors-scope

- **RNG seedable / parties reproductibles** : repoussé. L'agrégation sur grand N
  suffit pour l'équilibrage ; un seed nécessiterait de toucher `combat.js` et
  `units.js`, contraire à la contrainte de non-impact.
- **Export JSON / graphes** : repoussé à un PRD ultérieur ; sortie console
  uniquement pour cette première version.
- **Optimisation automatique des poids** (recherche/grid search) : hors-scope ;
  le harness mesure, l'analyse reste manuelle.
- **Intégration UI** (lancer le harness depuis le jeu) : hors-scope, c'est un
  outil CLI séparé.

## Impacts par couche

- `harness/run.js` (nouveau) : point d'entrée CLI, lecture des profils, boucle de
  simulation, adaptateur de perspective, agrégation et affichage console.
- `harness/profiles.js` (nouveau, optionnel) : définition des profils/matchups à
  simuler.
- `src/ai.js` : `computeAIAction(state, weights?)` et `pickBestUnit(state, weights?)`
  acceptent des poids optionnels ; valeurs par défaut = constantes actuelles.
  **Aucun changement de comportement** sans argument.
- Aucune autre modification de `src/` (combat, terrain, game, units restent
  intacts).

## Critères d'acceptation

- `node harness/run.js` exécute N parties par profil et affiche un tableau de
  stats sans erreur, sans dépendre de React/DOM.
- Le harness n'importe que des fonctions pures de `src/` ; aucun import depuis
  `App.jsx`/`renderer.js`/`online.js`.
- Sans passer de poids, `computeAIAction(state)` produit des décisions
  identiques à l'existant (les tests `ai.test.js` actuels passent inchangés).
- L'adaptateur de perspective permet à l'IA de jouer le joueur 1 : sur un
  matchup symétrique (mêmes armées, terrain équilibré), les taux de victoire J1
  et J2 sont proches (écart attribuable au seul avantage du premier joueur, pas
  à un camp non joué).
- Toute partie se termine (victoire, nul au round 7, ou avortée au plafond) ;
  aucune boucle infinie.

## Tests

- `tests/harness.test.js` (nouveau) : une partie complète se déroule jusqu'à un
  `winner` non nul via la boucle headless ; l'adaptateur de perspective renvoie
  une action valide pour le joueur 1 ; `computeAIAction(state)` sans poids donne
  le même résultat qu'avec les poids par défaut explicites.
- `tests/ai.test.js` (existant) : doit rester vert sans modification (preuve de
  non-régression du paramétrage des poids).

## Risques / questions ouvertes

- **Attribution des kills par type d'unité** : `state.kills` n'est compté que par
  joueur. L'attribution par type d'unité se fait par observation de l'état entre
  actions (best effort) ; granularité à valider en jeu, sinon se limiter à la
  survie par type pour la v1.
- **Coût d'exécution** : N élevé × plusieurs profils peut être lent (combat =
  jets de dés répétés). Régler N et le nombre de profils ; possibilité de
  paralléliser plus tard (hors-scope ici).
- **Représentativité sans seed** : les conclusions ne valent que sur grand N ;
  documenter le N minimal recommandé une fois mesurée la variance des taux de
  victoire.
- **Tension poids variables vs non-impact** : levée par le défaut rétro-compatible,
  mais toute future divergence des constantes par défaut dans `ai.js` devra
  rester synchronisée avec le jeu réel.
