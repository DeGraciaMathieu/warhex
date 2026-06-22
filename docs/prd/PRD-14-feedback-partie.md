# PRD 14 — Feedback de partie : modal de fin, transition de tour, fin de round

**Priorité : 2 — Impact ★★ — Effort moyen**

## Objectif

Rendre lisibles les trois moments-clés d'une partie qui passent aujourd'hui
inaperçus : (1) la **fin de partie**, reléguée dans un coin du panneau latéral ;
(2) le **changement de joueur**, signalé seulement par une petite puce ; (3) le
**décompte des points en fin de round**, qui ne se traduit que par un discret
« +N » sur la frise. Le but est de matérialiser chacun par un retour visuel
explicite (modal de victoire, bannière de transition, bannière de fin de round),
sans toucher à la logique de jeu.

## Existant technique

- **Écran de fin = panneau latéral inline** (`src/App.jsx:835-860`) : quand
  `state.winner` est non nul, le panneau de droite (320 px) affiche le titre
  vainqueur/égalité, les kills + pts par joueur, `ScoreChart` et le bouton
  « ↺ Nouvelle partie » (`restart`). Aucun overlay : facile à manquer, peu
  marquant. Le titre vainqueur apparaît aussi dans la puce sous le plateau
  (`App.jsx:778`).
- **Infra de modal déjà en place** : `.combat-overlay` / `.combat-modal`
  (`src/styles.css:509-557`) avec animations `overlayIn` / `modalIn`
  (`styles.css:767-776`). La modal de combat (`App.jsx:1065+`) montre le motif :
  overlay plein écran, fermeture au clic sur le fond, `stopPropagation` sur le
  contenu. Réutilisable pour la modal de fin.
- **`ScoreChart`** (`App.jsx:26`) trace l'évolution du score cumulé par round à
  partir de `scoreHistory` ; déjà consommé par l'écran de fin actuel, fiable et
  déterministe.
- **Stats disponibles dans l'état** : `state.scores` (cumulé par joueur),
  `state.kills` (total par joueur), `state.scoreHistory`
  (`[{ round, scores: { 1, 2 } }]` cumulé), `state.townOwnership`, `state.units`.
  **Pas de kills par unité/type** (granularité par joueur uniquement).
- **Scoring uniquement en fin de round** dans `computeEndTurn`
  (`src/game.js:339-347`) : `endOfRound` vrai quand `nextPlayer ===
  firstPlayerOfRound(s.round)` ; on ajoute alors `computeTownControl(townOwnership)[p]`
  à `scores[p]`, on pousse une entrée cumulée dans `scoreHistory`, et on calcule
  `winner = checkWinner(scores, s.round)`. `newCurrentPlayer` =
  `firstPlayerOfRound(newRound)` en fin de round, sinon `nextPlayer`.
- **Changement de joueur dérivable** : `state.currentPlayer` change à chaque
  `computeEndTurn` (sauf fin de partie). Aucun champ « tour précédent » stocké.
- **Gain par round dérivable** : helper pur `roundGains(scoreHistory)`
  (`src/units.js`) → `[{ round, gain: { 1, 2 } }]`, déjà utilisé par l'animation
  « +N » de la frise (`App.jsx:223-235`, état `scoreFx`, `SCORE_FX_DURATION`).
- **Frise des tours + « +N » flottant** (PRD 08/10) déjà implémentés
  (`App.jsx:787-831`, CSS `frise-bubble.scored` / `frise-float`,
  `styles.css:484-507`). Ce PRD **les conserve** et ajoute des bannières plus
  visibles ; il ne refait pas la frise.
- **Modes de jeu** : `vsAI` (IA = joueur 2) et `online` (`notMyTurn`) pilotent
  déjà les `disabled` des boutons. Les animations existantes (`scoreFx`) sont
  pilotées par l'état → fonctionnent aussi pour les tours IA / en ligne.
- Convention projet (CLAUDE.md) : toute logique métier dans des fonctions pures
  exportées ; `App.jsx` n'orchestre que l'état et le rendu. La détection des
  transitions reste un effet d'orchestration React (comparaison à une `ref`,
  comme `prevScoreLen` pour `scoreFx`).

## Comportement

### A. Modal de fin de partie

1. Quand `state.winner` devient non nul, afficher une **modal overlay** centrée
   par-dessus le plateau (réutilise `.combat-overlay` / `.combat-modal` ou des
   classes sœurs), à la place du rôle actuel du panneau latéral.
2. Contenu :
   - **Titre** : « 🏆 JOUEUR X VICTORIEUX » ou « ⚖ ÉGALITÉ » (`winner === "draw"`),
     teinté `P[winner]`.
   - **Score final** des deux joueurs + **écart** de victoire (différence
     `|scores[1] - scores[2]|`), aux couleurs joueurs.
   - **Kills** par joueur (`state.kills`).
   - **Graphe d'évolution** : `ScoreChart` réutilisé tel quel (si
     `scoreHistory.length > 0`).
   - Bouton **« ↺ Nouvelle partie »** appelant `restart`.
3. La modal est **bloquante** (overlay assombri) ; pas de fermeture au clic sur
   le fond (contrairement à la modal de combat) — seul le bouton rejouer permet
   d'enchaîner. Le plateau final reste visible derrière l'overlay.
4. **Stats hors-scope** : villes contrôlées finales et nombre d'unités
   survivantes ne sont **pas** affichés (cf. Hors-scope).

### B. Bannière de transition de tour

5. **À chaque changement de `state.currentPlayer`** (hotseat local, vs IA et en
   ligne), afficher une **bannière brève centrée** « AU TOUR DE — JOUEUR X »,
   teintée `P[currentPlayer]`.
6. La bannière est **non bloquante** : elle apparaît, reste affichée une durée
   réglable (constante `TURN_BANNER_DURATION`, ~1000 ms) puis **s'estompe d'elle-même**
   (animation CSS d'apparition + fondu). Elle n'intercepte pas les clics sur le
   plateau.
7. Détection par comparaison de `state.currentPlayer` à une `ref` du joueur
   précédent (motif `prevScoreLen`/`scoreFx`). Aucune bannière au tout premier
   rendu d'une partie (initialisation de la ref), ni quand `state.winner` est non
   nul (la modal de fin prend le relais).
8. La bannière ne se déclenche **pas** sur les changements internes de phase
   (sélection/mouvement/attaque) ni sur les changements d'`activationsUsed` —
   uniquement sur le changement de joueur.

### C. Bannière de fin de round (gain de points)

9. **À chaque fin de round** (apparition d'une nouvelle entrée dans
   `scoreHistory`, même déclencheur que `scoreFx`), afficher une **bannière brève**
   « FIN DU ROUND X — 🏰 J1 +N₁  🏰 J2 +N₂ », où Nᵢ = gain du round dérivé de
   `roundGains(scoreHistory)`. Seuls les joueurs ayant marqué (gain > 0) sont
   listés ; si aucun joueur ne marque, aucune bannière.
10. Réutilise le **même mécanisme/visuel** que la bannière de transition (B),
    avec un libellé différent ; durée réglable (peut partager
    `TURN_BANNER_DURATION` ou une constante dédiée). Non bloquante, s'estompe
    seule.
11. La bannière de fin de round **complète** le « +N » flottant existant sur la
    frise (PRD 10), qui est conservé. En fin de round qui clôt la partie
    (`winner` non nul), la modal de fin (A) prime ; la bannière de fin de round
    peut être omise ou jouée une fois avant l'ouverture de la modal (à régler en
    jeu).
12. **Réglages** (constantes en tête du composant) : `TURN_BANNER_DURATION`,
    éventuelle `ROUND_BANNER_DURATION`. Aucune valeur magique en dur.

## Hors-scope

- **Villes contrôlées finales / unités survivantes** dans la modal de fin :
  écartés (réponse produit) ; la modal se limite à score+écart, kills, graphe.
- **MVP / kills par unité ou par type** : `state` ne suit les kills que par
  joueur ; un suivi plus fin nécessiterait de toucher `combat.js`/`game.js` →
  repoussé à un PRD ultérieur.
- **Refonte de la frise des tours** et de l'animation « +N » (PRD 08/10) : déjà
  en place, conservées telles quelles.
- **Flash des villes sur le plateau** au décompte (option `renderer.js`) :
  écarté au profit de la bannière de fin de round.
- **Modification de la logique de scoring / victoire** (`computeEndTurn`,
  `checkWinner`, contrôle des villes) : les bannières et la modal restent
  purement consommatrices de l'état.
- **Rendu canvas** : modal et bannières sont en DOM ; `renderer.js` n'est pas
  touché.
- **File d'attente de bannières** (transition + fin de round simultanées) :
  best-effort ; en fin de round le changement de joueur et le gain coïncident —
  privilégier la bannière de fin de round, ou les enchaîner (à régler en jeu),
  sans système de queue dédié.

## Impacts par couche

- `src/App.jsx` :
  - Modal de fin : remplacer le bloc inline `835-860` par une modal overlay
    (overlay + contenu : titre, score/écart, kills, `ScoreChart`, bouton
    `restart`). Le panneau latéral n'affiche alors plus l'écran de fin.
  - Bannière de transition : nouvel état + effet comparant `state.currentPlayer`
    à une `ref`, rendu d'un élément DOM par-dessus le plateau, auto-effacement par
    timer (`TURN_BANNER_DURATION`).
  - Bannière de fin de round : nouvel état + réutilisation du déclencheur
    `scoreHistory` (mutualisable avec `scoreFx`) et de `roundGains`.
- `src/styles.css` : classes/keyframes pour la modal de fin (réutilise/dérive
  `.combat-overlay`/`.combat-modal`) et pour les bannières (apparition + fondu),
  cohérentes avec le thème clair.
- Aucune modification de `src/game.js` (logique), `src/units.js`, `src/ai.js`,
  `src/renderer.js`, `src/online.js`, ni du harness.
- **Aucun nouveau champ d'état de jeu** : tout est dérivé de `winner`,
  `currentPlayer`, `scores`, `kills`, `scoreHistory`. `initState` inchangé. Les
  états React ajoutés sont locaux à `App.jsx` (UI), comme `scoreFx`.

## Critères d'acceptation

- À la victoire/égalité, une **modal overlay** centrée s'affiche par-dessus le
  plateau avec titre vainqueur (couleur joueur), score final + écart, kills, le
  graphe `ScoreChart`, et un bouton « Nouvelle partie » fonctionnel ; le clic sur
  le fond ne la ferme pas.
- L'écran de fin **n'apparaît plus** comme panneau latéral inline (pas de double
  affichage).
- À **chaque changement de `currentPlayer`** (hotseat, vs IA, en ligne), la
  bannière « AU TOUR DE JOUEUR X » s'affiche brièvement aux couleurs du joueur
  puis s'estompe seule, sans bloquer les clics, et **pas** au premier rendu ni
  quand `winner` est non nul.
- Un changement de phase ou d'`activationsUsed` sans changement de joueur ne
  déclenche **aucune** bannière de transition.
- À **chaque fin de round** où au moins un joueur marque, la bannière « FIN DU
  ROUND X — +N par joueur » s'affiche, avec les bons gains dérivés de
  `roundGains` ; aucune bannière si personne ne marque.
- Le « +N » flottant de la frise et `ScoreChart` restent inchangés (pas de
  régression).
- Les bannières et la modal sont **dérivées purement de l'état** (même état →
  même affichage) et fonctionnent identiquement que le tour soit joué par un
  humain, l'IA ou l'adversaire en ligne.

## Tests

- `tests/units.test.js` (existant) : `roundGains` déjà couvert (gain par round,
  base 0, gain nul, `scoreHistory` vide) — sert de base au libellé de la bannière
  de fin de round ; compléter si un cas manque (un seul joueur marque).
- `tests/game.test.js` (existant) : confirmer l'invariant « `computeEndTurn` ne
  pousse une entrée `scoreHistory` qu'en fin de round » et « `currentPlayer`
  change à chaque `computeEndTurn` hors fin de partie » — garantit que bannières
  et modal se déclenchent aux bons moments.
- Rendu DOM / animations (modal, bannières) **non couverts** (pas de tests DOM
  dans le repo) → vérification visuelle, comme pour la frise (PRD 08/10).

## Risques / questions ouvertes

- **Collision transition / fin de round** : en fin de round, `currentPlayer`
  change ET un gain tombe en même temps → deux bannières candidates. Choix par
  défaut : prioriser la bannière de fin de round (plus informative) ou les
  enchaîner ; à trancher en jeu, sans queue dédiée (hors-scope).
- **Robustesse aux états transitoires** : les bannières doivent réagir à l'état
  de jeu courant, pas aux re-rendus dus aux animations (`movingUnit`, `aiPreview`,
  `diceAnim`). La détection par `ref` (joueur précédent / longueur `scoreHistory`)
  doit être robuste à ces re-rendus, comme `scoreFx`.
- **Rythme en vs IA / en ligne** : une bannière à chaque changement de joueur
  pendant les tours IA rapides peut surcharger visuellement ; régler
  `TURN_BANNER_DURATION` et valider que les bannières ne s'empilent pas (un timer
  remplaçant le précédent).
- **Modal bloquante et fin de partie en ligne** : vérifier que la modal s'affiche
  bien des deux côtés quand l'adversaire clôt la partie (déclenchement piloté par
  `state.winner` reçu, pas par une action locale).
- **Lisibilité** : bannières centrées sur fond clair et par-dessus le plateau —
  contraste et opacité du fond à valider en jeu.
