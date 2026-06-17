# PRD 09 — Tooltip de consolidation au-dessus de l'hexe

**Priorité : 2 — Impact ★★ — Effort faible**

## Objectif

Quand une unité tue un ennemi adjacent au corps à corps, le jeu propose de
prendre sa place (consolidation). Aujourd'hui ce choix n'est visible que dans le
panneau latéral ACTIONS, loin de l'action sur le plateau : le joueur peut ne pas
le remarquer ou ne pas faire le lien avec l'hexe concerné. On veut rendre la
proposition lisible et localisée en affichant un tooltip flottant Oui / Non
directement au-dessus de l'hexe de l'unité éliminée.

## Existant technique

- Le mécanisme existe sous le nom **consolidation**. Quand une attaque de mêlée
  tue une cible adjacente, `game.js:301` (`canConsolidate`) fait passer la phase
  à `"consolidate"` avec `pendingConsolidation: { unitId, hex }` (`game.js:305`).
- Le choix est résolu par `computeConsolidate(s, accept)` (`game.js:125`) :
  `accept = true` déplace l'unité sur `pending.hex` et applique les effets de
  terrain d'arrivée ; `accept = false` finit l'activation sur place.
- Deux entrées UI aujourd'hui :
  - les boutons du panneau latéral « ⟶ Prendre la place » / « ✕ Rester »
    (`App.jsx:794-799`) ;
  - le clic direct sur l'hexe cible vaut acceptation (`game.js:186`).
- L'IA tranche automatiquement via `shouldConsolidate` (`ai.js:297`) puis
  `decideAIAction` (`ai.js:319-321`) — aucune UI nécessaire de son côté.
- Le rendu DOM d'un tooltip existe déjà : `.unit-tooltip` est en
  `position: fixed` (`styles.css:187-188`) et positionné via `tooltipPos`
  (`App.jsx:823`). Le tooltip de stats d'unité (PRD 05) sert de modèle.
- Conversion hexe → pixel : `hexToPixel(q, r)` (`hex.js:3`) donne des
  coordonnées relatives au centre ; le centre du canvas est `OX, OY`
  (`renderer.js:6-7`), canvas interne `CANVAS_W=700` × `CANVAS_H=616`.
- Le canvas est affiché en `maxWidth: 100%` (`App.jsx:702`) : il peut être mis à
  l'échelle, donc le placement écran doit appliquer le ratio
  `rect.width / CANVAS_W` à partir de `canvasRef.getBoundingClientRect()`.
- Garde-fous d'interaction déjà en place : `vsAI && currentPlayer === 2` et
  `notMyTurn` (online) désactivent les boutons (`App.jsx:797-798`).

## Comportement

1. Dès que la phase vaut `"consolidate"` et que `state.pendingConsolidation`
   existe, un tooltip flottant s'affiche, centré horizontalement sur l'hexe
   `pendingConsolidation.hex` et ancré au-dessus de celui-ci.
2. Le tooltip contient un libellé court (ex. « Prendre la place ? ») et deux
   boutons cliquables : **Oui** (✓) → `computeConsolidate(s, true)`, **Non** (✕)
   → `computeConsolidate(s, false)`.
3. Les boutons du panneau latéral ACTIONS sont **conservés** et restent
   fonctionnels : le tooltip s'ajoute, il ne remplace pas le panneau.
4. Le tooltip n'apparaît que lorsque le joueur courant peut décider : masqué (ou
   boutons désactivés) quand `vsAI && currentPlayer === 2` ou `notMyTurn`, en
   cohérence avec les gardes des boutons existants.
5. Position calculée à partir de `hexToPixel(hex.q, hex.r)` + `(OX, OY)`,
   multipliée par le ratio d'affichage du canvas, puis décalée de
   `rect.left / rect.top`. Le tooltip est ancré au-dessus du centre de l'hexe
   (décalage vertical négatif d'environ un rayon d'hexe).
6. Le clic direct sur l'hexe cible continue de valoir acceptation (comportement
   `game.js:186` inchangé).

## Hors-scope

- **Refonte des autres tooltips** : le tooltip de stats d'unité (PRD 05) et le
  modal de choix d'arme ne sont pas modifiés ; on réutilise leurs conventions de
  style sans les toucher.
- Repositionnement dynamique sur scroll/resize pendant que le tooltip est
  affiché si cela alourdit l'implémentation : la phase consolidate est brève et
  modale, un calcul au rendu suffit (à réévaluer si décalage constaté).

## Impacts par couche

- `src/App.jsx` : nouveau bloc de rendu conditionnel (sur le modèle de
  `App.jsx:815-864`) affichant le tooltip de consolidation positionné au-dessus
  de l'hexe ; calcul de la position écran à partir de `canvasRef`,
  `hexToPixel`, `OX/OY` et du ratio d'échelle ; câblage des deux boutons sur
  `computeConsolidate`.
- `src/styles.css` : classes du tooltip de consolidation (conteneur flottant +
  boutons Oui/Non), dans l'esprit de `.unit-tooltip` (`styles.css:187+`).
- `src/hex.js` / `src/renderer.js` : aucune modification (constantes et
  `hexToPixel` réutilisés en import).
- `src/game.js`, `src/ai.js`, `src/units.js` : aucune modification — la logique
  de consolidation et son état existent déjà.

## Critères d'acceptation

- En partie locale, tuer un ennemi adjacent en mêlée fait apparaître le tooltip
  Oui/Non centré au-dessus de l'hexe de l'unité éliminée.
- Cliquer **Oui** déplace l'unité sur l'hexe (effets de terrain appliqués) et
  termine l'activation ; cliquer **Non** termine l'activation sur place — même
  résultat que les boutons du panneau latéral.
- Les boutons du panneau latéral restent présents et produisent le même effet
  que le tooltip.
- Le tooltip ne s'affiche pas (ou est non interactif) pour la consolidation de
  l'IA en mode vsAI, ni pour le joueur dont ce n'est pas le tour en online.
- Le tooltip reste correctement ancré au-dessus de l'hexe même lorsque le canvas
  est affiché à une taille réduite (maxWidth 100%).

## Tests

- `tests/game.test.js` (ou fichier de consolidation existant) : couverture déjà
  assurée pour `computeConsolidate(true/false)` — vérifier qu'aucune régression
  n'est introduite (le PRD n'ajoute pas de logique métier).
- Le rendu/positionnement du tooltip relève du DOM React et n'est pas couvert
  par les tests unitaires existants : vérification manuelle en jeu.

## Risques / questions ouvertes

- Le ratio d'échelle du canvas (`maxWidth: 100%`) doit être pris en compte sous
  peine de tooltip décalé sur petits écrans ; point à vérifier en jeu.
- Le tooltip ne doit pas masquer l'hexe ni l'unité concernée — ajuster le
  décalage vertical / la flèche d'ancrage après essai visuel.
- Redondance assumée avec le panneau latéral : à réévaluer après usage si elle
  crée de la confusion plutôt qu'un filet de sécurité.
