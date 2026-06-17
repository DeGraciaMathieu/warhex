# PRD 08 — Frise visuelle du déroulement des tours (bulles)

**Priorité : 2 — Impact ★★ — Effort faible**

## Objectif

Rendre lisible le déroulement d'une partie, d'autant plus depuis que l'ordre des
tours alterne (PRD 07). Aujourd'hui le joueur n'a qu'un texte `TOUR x/8` et la
puce « qui joue » : impossible de voir d'un coup d'œil où l'on en est ni qui
jouera ensuite. Une frise de **16 bulles colorées** (une par demi-tour) affiche la
séquence d'alternance `1 2 2 1…`, surligne le demi-tour courant et montre les
tours à venir — utile pour anticiper qui clôt chaque round (donc qui marque en
dernier).

## Existant technique

- Le plateau est un `<canvas>` (`src/App.jsx:696`). Juste en dessous, une rangée
  flex (`App.jsx:706`) regroupe déjà la puce « tour courant » (à gauche, teintée
  de `P[currentPlayer]`) et la puce score + `TOUR {round}/{ROUNDS_PER_GAME}`
  (à droite).
- Couleurs joueurs centralisées : `P = { 1: "#2a6fa8", 2: "#a03030" }`
  (`App.jsx:424`), conformes au thème (bleu J1 / rouge J2).
- L'état expose tout le nécessaire : `round`, `currentPlayer`, `activationsUsed`,
  ainsi que les constantes `ROUNDS_PER_GAME` (= 8) et `ACTIVATIONS_PER_TURN`
  (= 2), et le helper `firstPlayerOfRound(round)` (`src/units.js`, PRD 07).
- **Le calendrier complet est déterministe et entièrement dérivable** : 8 rounds ×
  2 demi-tours = 16 demi-tours, séquence des joueurs `1 2 2 1 1 2 2 1…` obtenue à
  partir de `firstPlayerOfRound`. Aucune donnée à stocker, aucun nouveau champ
  d'état.
- Aucun composant de frise n'existe ; la feature est de l'**UI purement additive
  (DOM, pas canvas)**, sans toucher à la logique de jeu ni à `renderer.js`.
- Convention projet (CLAUDE.md) : la logique métier vit dans des fonctions pures
  exportées, `App.jsx` ne fait qu'orchestrer le rendu. Le calendrier des demi-tours
  est une donnée de jeu → il sera produit par un **helper pur exporté**, et
  `App.jsx` se contentera de le dessiner.

## Comportement

1. **Frise de 16 bulles** affichée **sous le plateau**, regroupée avec les puces
   tour/score existantes (`App.jsx:706`). Une bulle par demi-tour, dans l'ordre
   chronologique (round 1 demi-tour 1, round 1 demi-tour 2, round 2 demi-tour 1…).
   Séquence des joueurs : `1 2 2 1 1 2 2 1 1 2 2 1 1 2 2 1`.
2. **Couleur** de chaque bulle = couleur du joueur de ce demi-tour (`P[player]`).
3. **Trois états visuels** (remplissage binaire + surlignage, *pas* de paliers par
   activation) :
   - **Passé** (demi-tours déjà joués) : bulle pleine.
   - **Courant** (demi-tour en cours) : bulle pleine + surlignage (halo / contour
     accentué ou légère pulsation).
   - **À venir** : bulle atténuée (couleur du joueur en contour ou transparence).
4. **Position courante** dérivée de l'état :
   `index = (round - 1) * 2 + (currentPlayer === firstPlayerOfRound(round) ? 0 : 1)`.
   Les bulles d'index `<` courant sont « passé », `=` courant, `>` à venir.
5. **Regroupement par round** : léger espacement supplémentaire entre chaque paire
   de bulles (un round = 2 bulles) pour lire les 8 rounds.
6. **Fin de partie** (`winner` non nul) : aucune bulle « courante » ; tous les
   demi-tours joués restent pleins.
7. **Helper pur exporté** (`src/units.js`, à côté de `firstPlayerOfRound`) :
   `turnSchedule(rounds = ROUNDS_PER_GAME)` → tableau de `{ round, player }`
   (16 entrées), et un calcul d'index courant à partir de `(round, currentPlayer)`.
   `App.jsx` rend la frise à partir de ce helper + `P` + l'état.
8. La frise **complète** l'indicateur `TOUR x/8` (texte conservé), elle ne le
   remplace pas.
9. **Réglages** (constantes en tête du composant) : diamètre des bulles (~10-12 px),
   gap entre bulles, gap inter-round. La frise reste dérivée de `ROUNDS_PER_GAME`
   (jamais 16 codé en dur).

## Hors-scope

- **Remplissage par activation** (2 paliers dans la bulle courante) : écarté au
  profit du binaire + surlignage.
- **Interaction sur les bulles** (survol/clic pour voir le score du round via
  `scoreHistory`, déjà présent dans l'état) : repoussé à un PRD ultérieur.
- **Affichage des scores par round** dans la frise / tooltip : hors-scope.
- **Rendu dans le canvas** : la frise est en DOM, `renderer.js` n'est pas touché.
- **Optimisation responsive fine (mobile)** : best-effort (le `maxWidth` existe
  déjà), pas d'objectif dédié.

## Impacts par couche

- `src/units.js` : ajout d'un helper pur `turnSchedule(rounds?)` (et éventuellement
  un `currentTurnIndex(round, currentPlayer)`), co-localisé avec `firstPlayerOfRound`.
  Donnée de jeu pure, testable sans React.
- `src/App.jsx` : nouveau markup de la frise (16 bulles DOM) sous le canvas,
  alimenté par le helper + `P` + l'état ; conserve la puce `TOUR x/8`.
- Aucune modification de `renderer.js`, `game.js` (logique), `ai.js`, ni du harness.
- Aucun nouveau champ d'état (tout dérivable) → `initState` inchangé.

## Critères d'acceptation

- 16 bulles affichées dans l'ordre chronologique, couleurs correspondant à la
  séquence `1 2 2 1 1 2 2 1 1 2 2 1 1 2 2 1`.
- La bulle du demi-tour courant est surlignée ; les précédentes sont pleines, les
  suivantes atténuées.
- Avancer d'un demi-tour (`computeEndTurn`) déplace le surlignage d'**exactement
  une bulle**.
- En fin de round, le surlignage passe au **starter du round suivant** (suit
  l'alternance, pas un simple « joueur opposé »).
- À la victoire, aucune bulle n'est marquée « courante ».
- La frise est **dérivée purement de l'état** (déterministe) : même état → même
  frise. Le helper de calendrier est testable hors React.
- Aucune régression du rendu canvas ni des puces tour/score existantes.

## Tests

- `tests/units.test.js` : `turnSchedule(8)` renvoie 16 entrées `{ round, player }`
  dans l'ordre `1 2 2 1…` ; chaque joueur totalise 8 demi-tours ; pour chaque round
  `r`, la 1re entrée du round a `player === firstPlayerOfRound(r)`.
- `tests/units.test.js` : le calcul d'index courant donne le bon demi-tour (1er vs
  2e du round) selon `firstPlayerOfRound` pour des couples `(round, currentPlayer)`
  représentatifs, y compris un round pair (ouvert par J2).
- Rendu DOM non couvert (pas de tests DOM dans le repo) → vérification visuelle.

## Risques / questions ouvertes

- **Largeur** : 16 bulles + espacements doivent tenir sous `CANVAS_W` sans
  déborder ; régler diamètre/gap. Sur petits écrans (`maxWidth: 100%`), prévoir un
  passage à la ligne ou une réduction.
- **Contraste des états** : bulles « à venir » atténuées vs « passées » pleines en
  couleurs joueur sur fond beige clair — lisibilité à valider en jeu.
- **Robustesse à `ROUNDS_PER_GAME`** : la frise doit rester dérivée de la constante
  (aucun 16 en dur) pour suivre un éventuel changement de durée de partie.
- **Cohérence pendant les animations** (`aiPreview`, déplacement) : le surlignage
  doit refléter l'état de jeu courant, pas un état transitoire d'animation.
