# PRD 07 — Alternance de l'ordre de tour (séquence 1 2 2 1) et 8 rounds

**Priorité : 1 — Impact ★★★ — Effort faible**

## Objectif

Corriger un défaut d'équité qui touche **100 % des parties**. Aujourd'hui J1 joue
toujours en premier et J2 toujours en dernier dans chaque round ; or le score est
échantillonné en fin de round, juste après le tour de J2. Comme la possession de
ville est « collante » (acquise en posant le pied dessus), J2 contrôle les villes
contestées au moment précis du comptage → avantage du dernier joueur, mesuré au
harness à **+14 à +24 points de taux de victoire** en miroir. On neutralise ce
biais en faisant **alterner le joueur qui commence chaque round** (suite des
demi-tours `1 2 2 1 1 2 2 1…`), et on passe à **8 rounds** (nombre pair) pour que
chaque camp commence et clôt exactement 4 rounds (équilibre parfait du dernier
coup, 4-4).

## Existant technique

- **Ordre de tour câblé sur « J1 commence »** (`src/game.js:320-321`) :
  `nextPlayer = currentPlayer === 1 ? 2 : 1` puis `endOfRound = nextPlayer === 1`.
  La détection de fin de round suppose donc que J1 ouvre chaque round, et
  `currentPlayer` devient toujours `nextPlayer` (`game.js:334`).
- **Score échantillonné en fin de round** (`computeEndTurn`, `game.js:323-327`) :
  à `endOfRound`, `computeTownControl(townOwnership)` est ajouté aux scores.
  `townOwnership[k]` n'est mis à jour qu'en posant le pied sur la ville
  (`game.js:120`) et n'est jamais réinitialisé → le dernier à se poser avant le
  snapshot contrôle la ville.
- **Durée de partie codée en dur à 7** : `checkWinner(scores, round)` renvoie
  `null` tant que `round < 7` (`src/units.js:151`) → la partie s'arrête après le
  comptage du round 7. Aucune constante centralisée : `7` est aussi codé en dur
  dans l'UI (`src/App.jsx:716`, `TOUR {round}/7`).
- **Structure du round** : `ACTIVATIONS_PER_TURN = 2` (`units.js:3`). Un *demi-tour*
  = 2 activations d'un joueur ; un *round* = 2 demi-tours (un par joueur).
- **IA câblée sur le joueur 2** : `src/App.jsx:345` déclenche l'IA quand
  `currentPlayer === 2`. Elle suivra donc l'alternance automatiquement, sans
  modification de `ai.js`.
- **Déterminisme** : le joueur qui commence un round est dérivable de la **parité
  de `round`** ; aucun nouveau champ d'état n'est nécessaire (compatible online et
  tests). `initState` fixe `currentPlayer: 1`, `round: 1` (`units.js:290,299`).
- `scoreHistory` enregistre une entrée par round (`game.js:328`), indexée par
  `round` — insensible à l'ordre des joueurs.

## Comportement

1. **Starter d'un round** : `firstPlayerOfRound(round)` = `1` si `round` est
   impair, `2` si pair. Le round 1 commence donc toujours par **J1** (déterministe).
2. **Séquence des demi-tours** sur une partie de 8 rounds :
   `1 2 | 2 1 | 1 2 | 2 1 | 1 2 | 2 1 | 1 2 | 2 1`, soit
   `1 2 2 1 1 2 2 1 1 2 2 1 1 2 2 1`. Chaque joueur **commence 4 rounds** et **clôt
   4 rounds**.
3. **Détection de fin de round** : un round comporte exactement 2 demi-tours (un
   par joueur). La fin de round survient quand le prochain joueur redevient le
   starter du round courant (les deux ont joué) :
   `endOfRound = (nextPlayer === firstPlayerOfRound(s.round))`.
4. **Comptage du score inchangé** : à `endOfRound`, on ajoute toujours
   `computeTownControl` aux scores et on pousse une entrée dans `scoreHistory`.
   Seul le *moment* (qui joue en dernier) alterne.
5. **Joueur suivant** : à la fin d'un round (hors victoire), `currentPlayer`
   devient le starter du **round suivant** (`firstPlayerOfRound(newRound)`), pas
   forcément l'autre joueur. En cours de round, `currentPlayer` devient
   `nextPlayer` comme aujourd'hui.
6. **Durée portée à 8 rounds** : introduire une constante centralisée
   `ROUNDS_PER_GAME = 8` (dans `units.js`). `checkWinner` ne tranche qu'à partir du
   round 8 (`round < ROUNDS_PER_GAME → null`). L'UI affiche `TOUR {round}/8`.
7. **Système d'activation inchangé** : à l'intérieur d'un demi-tour, les 2
   activations, `autoEndTurn` et la consolidation fonctionnent à l'identique.

## Hors-scope

- **Vraie suite de Thue-Morse** : l'alternance simple par round suffit à atteindre
  l'équilibre 4-4 du dernier coup ; la suite stricte (`1 2 2 1 2 1 1 2…`) n'apporte
  aucun gain ici et complexifie le calcul. Repoussé / non retenu.
- **Tirage aléatoire du starter du round 1** : option écartée au profit du
  déterministe (J1 fixe) pour la stabilité des tests ; l'équilibre 4-4 est déjà
  atteint sans aléa.
- **Modification du mécanisme de score** (échantillonnage continu, demi-points) :
  hors-scope, l'alternance suffit.
- **Rééquilibrage des profils d'unités** (Warrior dominant, Berserker fragile,
  tir vs mêlée) : sujet distinct, PRD ultérieur.
- **Choix d'initiative par les joueurs** (décider qui commence) : hors-scope.

## Impacts par couche

- `src/units.js` : ajouter `ROUNDS_PER_GAME = 8` et un helper pur
  `firstPlayerOfRound(round)` ; `checkWinner` utilise `round < ROUNDS_PER_GAME`.
  `initState` inchangé (`currentPlayer: 1`, `round: 1`).
- `src/game.js` (`computeEndTurn`) : `endOfRound` calculé via
  `firstPlayerOfRound(s.round)` au lieu de `nextPlayer === 1` ; `currentPlayer`
  passé à `firstPlayerOfRound(newRound)` quand `endOfRound`, sinon `nextPlayer`.
  Comptage de score et `scoreHistory` inchangés.
- `src/App.jsx` : `TOUR {round}/7` → `/8` (idéalement via `ROUNDS_PER_GAME`).
- `src/ai.js` : **aucune** modification (suit `currentPlayer === 2`).
- `src/online.js` : aucune modification attendue (ordre dérivé déterministe,
  identique sur les deux pairs) — à confirmer.
- `harness/` : aucune modification fonctionnelle (la boucle passe par
  `computeEndTurn`) ; la métrique « Rounds moy » passera mécaniquement de ~7 à ~8.

## Critères d'acceptation

- En enregistrant `currentPlayer` à chaque demi-tour d'une partie complète, la
  séquence obtenue est exactement `1 2 2 1 1 2 2 1 1 2 2 1 1 2 2 1`.
- Sur 8 rounds, chaque joueur commence 4 rounds et clôt 4 rounds.
- Le score est compté **exactement une fois par round** (8 comptages), après le
  2e demi-tour du round ; `scoreHistory` contient 8 entrées.
- La partie se termine après le comptage du round 8 ; `checkWinner` renvoie `null`
  pour tout `round < 8`.
- **Déterminisme** : deux exécutions de la même partie produisent le même ordre de
  tour (round 1 = J1).
- **Validation harness** : sur un matchup miroir, l'écart de victoire J1/J2 est
  fortement réduit par rapport à la baseline (+14/+24) et proche de 50/50
  (valeur exacte à mesurer ; un résidu lié au tout premier coup reste possible).
- Tous les tests passent (`npx vitest run`), après mise à jour des tests qui
  supposaient 7 rounds ou « J1 commence toujours ».

## Tests

- `tests/game.test.js` : `computeEndTurn` alterne le starter (un round commencé
  par J1 se clôt sur J2 et le round suivant commence par J2) ; `endOfRound` ne se
  déclenche qu'après les 2 demi-tours ; le score est compté une seule fois par
  round ; la partie se termine au round 8 (`checkWinner` nul avant, tranché à 8).
- `tests/units.test.js` : `firstPlayerOfRound` renvoie J1 pour les rounds impairs,
  J2 pour les pairs ; `checkWinner` borne sur `ROUNDS_PER_GAME`.
- `tests/harness.test.js` (ou test dédié) : la séquence de `currentPlayer` sur une
  partie headless complète correspond au motif `1 2 2 1…`.
- Audit des tests existants référant à `round` 7 ou à l'ordre de tour, et mise à
  jour le cas échéant.

## Risques / questions ouvertes

- **Biais résiduel du tout premier coup** : l'alternance équilibre le *dernier*
  coup (4-4), mais J1 effectue malgré tout la toute première activation de la
  partie (et peut s'emparer des premières villes). À mesurer au harness ; en
  partie compensé par le fait que J2 clôt le round 1. Si un biais notable subsiste,
  réenvisager le tirage aléatoire du starter du round 1 (actuellement hors-scope).
- **Allongement des parties (~+14 %)** : 8 rounds au lieu de 7 → parties un peu
  plus longues (coût harness, durée de jeu). Jugé acceptable, à confirmer en jeu.
- **Dépendances cachées à « round impair = J1 »** : vérifier qu'aucun autre code
  (online, relecture de `scoreHistory`, UI) ne suppose l'ancien ordre fixe.
- **Réétalonnage de l'équilibrage** : une fois le biais J2 corrigé, les conclusions
  du harness sur les unités/terrains devront être relues sur la nouvelle base.
