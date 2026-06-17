# PRD 10 — Frise des tours enrichie : score par round + animation de gain

**Priorité : 2 — Impact ★★ — Effort moyen**

## Objectif

La frise des bulles (PRD 08) rend lisible *qui joue quand*, mais reste purement
décorative : elle ne dit rien des points marqués. Or le score est le cœur de la
partie et ne tombe qu'en fin de round (contrôle des villes) — un moment
aujourd'hui invisible, signalé seulement par le compteur `pts` qui change sans
emphase. Le but est de **rendre la frise plus présente et de matérialiser
l'instant où un joueur marque** : frise agrandie avec rounds repérés, score
cumulé affiché sous chaque round, et une animation (flash + halo + « +N »
flottant) sur la bulle qui clôt le round au moment du gain.

## Existant technique

- La frise est un bloc DOM (pas canvas) sous le plateau (`src/App.jsx:734-751`) :
  une rangée flex de **12 bulles** (`ROUNDS_PER_GAME` = 6 rounds × 2 demi-tours),
  alimentée par `turns` (= `turnSchedule()`) et `currentTurnIndex(round, currentPlayer)`
  (`src/units.js:16-30`). Trois états : passé (plein, `opacity .3`), courant
  (`boxShadow` halo + `scale 1.15`), à venir (plein, `opacity 1`). Un espacement
  supplémentaire (`marginLeft: 12`) sépare déjà chaque paire de bulles (= un round).
- Couleurs joueurs centralisées : `P = { 1: "#2a6fa8", 2: "#a03030" }` (`App.jsx:424`).
- **Le score n'est marqué qu'en fin de round** dans `computeEndTurn` (`src/game.js:324-331`) :
  `endOfRound` vrai quand le prochain joueur est le starter du round ; on ajoute
  alors `computeTownControl(townOwnership)[p]` à `scores[p]`, et on pousse une
  entrée `{ round, scores: { 1, 2 } }` (scores **cumulés**) dans `scoreHistory`.
  Hors fin de round, `scores` et `scoreHistory` sont inchangés.
- **Le gain d'un round est dérivable** : `scoreHistory[i].scores[p] -
  scoreHistory[i-1].scores[p]` (le 1er round : différence avec 0). Aucune donnée
  de gain par round n'est stockée séparément aujourd'hui.
- `scoreHistory` est déjà consommé par `ScoreChart` (`App.jsx:23`) à l'écran de
  victoire — donnée fiable et déterministe.
- Le calendrier des demi-tours est entièrement dérivé de l'état (déterministe,
  aucun champ stocké). La frise ne dépend que de `round`, `currentPlayer`,
  `winner` et désormais `scoreHistory`.
- Convention projet (CLAUDE.md) : logique métier dans des fonctions pures
  exportées, `App.jsx` n'orchestre que le rendu. Le calcul des gains par round est
  une donnée de jeu → **helper pur exporté**.

## Comportement

1. **Frise agrandie et structurée** sous le plateau, en remplacement du bloc
   actuel `App.jsx:734-751` :
   - bulles plus grandes (réglage `BUBBLE_SIZE`, ~20-22 px contre 16 aujourd'hui) ;
   - **séparateur visuel entre rounds** (fin trait/espace marqué entre chaque
     paire de bulles) ;
   - **numéro de round** affiché au-dessus (ou sous) chaque paire (`R1 … R6`).
   - La structure reste dérivée de `ROUNDS_PER_GAME` (jamais 6 ni 12 codés en dur),
     via `turnSchedule()`.
2. **États visuels des bulles** conservés (passé / courant / à venir), avec le
   surlignage du demi-tour courant repris de l'existant (halo + léger `scale`).
3. **Score cumulé par round** : sous chaque paire de bulles, afficher le score
   cumulé des **deux joueurs** à l'issue de ce round (ex. `2 – 1`, teinté
   `P[1]` / `P[2]`), lu depuis `scoreHistory`. Affiché **uniquement pour les rounds
   déjà clôturés** (présents dans `scoreHistory`) ; rounds non joués → pas de
   chiffre (ou tiret discret).
4. **Animation de gain en fin de round** (déclenchée quand une nouvelle entrée
   apparaît dans `scoreHistory`, donc à chaque `endOfRound`) :
   - **flash + halo** sur la(les) bulle(s) du round qui vient de se clore, dans la
     couleur du(des) joueur(s) ayant marqué ;
   - **« +N » flottant** par joueur ayant marqué (N = gain du round, dérivé de la
     différence de `scoreHistory`), qui monte et s'estompe au-dessus de la frise,
     en `P[player]` ;
   - durée brève (réglage, ~800-1200 ms) puis retour à l'état stable.
   - Si un joueur marque 0 ce round-là, pas de « +0 » ni de flash pour lui.
5. **Position courante** dérivée comme aujourd'hui : `currentTurnIndex(round,
   currentPlayer)`. Bulles d'index `<` courant = passé, `=` = courant, `>` = à venir.
6. **Fin de partie** (`winner` non nul) : aucune bulle « courante » ; tous les
   demi-tours restent pleins ; tous les scores par round restent affichés.
   L'animation du dernier gain peut se jouer une fois à l'arrivée sur l'écran final.
7. **Helper pur exporté** (`src/units.js`, à côté de `turnSchedule`) :
   `roundGains(scoreHistory)` → tableau `[{ round, gain: { 1, 2 } }]` calculant le
   gain par round (différence avec le round précédent, base 0 au 1er). Testable
   hors React. `App.jsx` consomme ce helper + `scoreHistory` + `P` pour le rendu
   et l'animation.
8. **Réglages** (constantes en tête du composant/fichier) : `BUBBLE_SIZE`, gap
   entre bulles, gap inter-round, durée d'animation. Aucune valeur magique en dur.

## Hors-scope

- **Animer un gain de points hors fin de round** : les points ne tombent qu'en
  fin de round par construction (`game.js`) — rien à animer entre-temps.
- **Mini-jauge / barre de score continue J1 vs J2** dans la frise : écartée au
  profit du chiffre cumulé par round (option non retenue).
- **Interaction (survol/clic) sur les bulles** pour détailler le round : repoussé
  à un PRD ultérieur.
- **Modification de la logique de scoring** (`computeEndTurn`, contrôle des villes)
  ou de `scoreHistory` : la frise reste purement consommatrice de l'état.
- **Rendu canvas** : la frise reste en DOM ; `renderer.js` n'est pas touché.
- **Responsive mobile fin** : best-effort (le `maxWidth` existe déjà), pas
  d'objectif dédié — la frise agrandie doit néanmoins tenir sous `CANVAS_W`.

## Impacts par couche

- `src/units.js` : ajout du helper pur `roundGains(scoreHistory)` (gain par round),
  co-localisé avec `turnSchedule` / `currentTurnIndex`. Donnée de jeu pure.
- `src/App.jsx` : refonte du bloc frise (`734-751`) → bulles agrandies, séparateurs
  + numéros de round, score cumulé par round sous chaque paire, et logique
  d'animation (détection d'une nouvelle entrée `scoreHistory` via un effet/ref,
  flash/halo + « +N » flottant). Conserve `turnSchedule` / `currentTurnIndex` et
  la puce `TOUR x/6`.
- `src/styles.css` : keyframes/classes pour le flash, le halo et le « +N » flottant
  (animation CSS plutôt que JS, cohérent avec le thème clair).
- Aucune modification de `renderer.js`, `game.js` (logique), `ai.js`, du harness,
  ni de `initState` (aucun nouveau champ d'état — tout dérivé de `scoreHistory`).

## Critères d'acceptation

- La frise affiche 12 bulles (= `ROUNDS_PER_GAME × 2`) agrandies, regroupées par
  round avec séparateur et numéro de round `R1…R6`, dérivées de `turnSchedule()`.
- Sous chaque round **clôturé**, le score cumulé `J1 – J2` est affiché aux bonnes
  couleurs ; les rounds non joués n'affichent pas de score.
- À chaque fin de round (`computeEndTurn` avec `endOfRound`), une animation se
  joue : flash/halo sur la bulle du round clos + « +N » flottant pour chaque
  joueur ayant marqué (N = gain dérivé de `scoreHistory`), et rien pour un gain de 0.
- Avancer d'un demi-tour sans fin de round ne déclenche **aucune** animation de
  gain et ne modifie pas les scores affichés.
- Le surlignage du demi-tour courant se déplace d'exactement une bulle par
  demi-tour ; en fin de round il passe au starter du round suivant.
- À la victoire : aucune bulle « courante », tous les scores par round visibles.
- `roundGains` est **pure et déterministe** (même `scoreHistory` → mêmes gains),
  testable hors React. La frise reste dérivée purement de l'état.
- Aucune régression du rendu canvas, des puces tour/score, ni de `ScoreChart`.

## Tests

- `tests/units.test.js` : `roundGains` renvoie le gain par round à partir d'un
  `scoreHistory` cumulé — 1er round = score brut (base 0), rounds suivants =
  différence avec le précédent ; gère un round à gain 0 ; `scoreHistory` vide →
  tableau vide ; cas où seul un joueur marque.
- `tests/game.test.js` (ou existant) : vérifier que `computeEndTurn` ne pousse une
  entrée `scoreHistory` qu'en fin de round (invariant déjà couvert à confirmer),
  garantissant que l'animation ne se déclenche qu'aux bons moments.
- Rendu DOM / animation non couverts (pas de tests DOM dans le repo) →
  vérification visuelle.

## Risques / questions ouvertes

- **Largeur** : bulles agrandies + séparateurs + numéros + scores doivent tenir
  sous `CANVAS_W` ; régler `BUBBLE_SIZE`/gaps, prévoir un retour à la ligne propre
  sur petit écran.
- **Détection du déclenchement** : l'animation doit se baser sur l'apparition
  d'une nouvelle entrée `scoreHistory` (comparaison avec la longueur précédente via
  une ref), pas sur un changement de `round`, pour rester robuste aux re-rendus et
  aux états transitoires (`aiPreview`, animations de déplacement).
- **Tours de l'IA / parties en ligne** : l'animation de gain doit se jouer aussi
  bien quand c'est l'IA ou l'adversaire qui clôt le round (déclenchement piloté par
  l'état reçu, pas par une action locale).
- **Lisibilité** : chiffres de score sous des bulles colorées sur fond beige —
  contraste à valider en jeu, surtout le « +N » flottant.
- **Rejeu du dernier gain** sur l'écran de victoire (point 6) : à confirmer en jeu,
  à désactiver si l'effet paraît redondant avec `ScoreChart`.
