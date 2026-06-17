# PRD 11 — Lisibilité des cibles à portée de combat

**Priorité : 2 — Impact ★★ — Effort faible**

## Objectif

Quand une unité est sélectionnée, il est difficile de voir quels ennemis sont réellement
attaquables et cliquables. Le seul signal actuel — un fond de case rouge translucide — est
masqué par le pion ennemi dessiné par-dessus. Le joueur peut manquer une attaque possible ou
cliquer dans le vide. On veut rendre les cibles ciblables immédiatement identifiables.

## Existant technique

- `game.js` : à la sélection d'une unité (`selectUnit`), `findValidTargets` remplit
  `state.validTargets` (les ennemis réellement attaquables : à portée d'au moins une arme +
  ligne de vue) et `computeAttackRange` remplit `state.attackRangeHexes` (cases vides à portée).
- `renderer.js` : la case d'une cible (`validTargetKeys`) reçoit un fond rouge
  `rgba(200,50,50,0.15)` (survol `0.35`) et un liseré `#cc3333`. Le pion ennemi (cercle plein
  P2) est **dessiné ensuite** dans la boucle `state.units.forEach`, recouvrant ce fond : il ne
  reste qu'un mince liseré difficilement visible. Aucun marqueur n'est posé sur le pion.
- Le pion sélectionné a déjà un halo (`ctx.shadowBlur`). L'`aiPreview` de type `select` utilise
  déjà un anneau pulsé `0.5 + 0.5 * Math.sin(Date.now() / 150)` — même motif réutilisable.
- `App.jsx` : la boucle `requestAnimationFrame` (l.288-311) ne tourne **que** s'il y a une
  animation active (mort, preview IA, impact, attaque, déplacement). À l'arrêt, `drawScene`
  n'est rappelé que sur changement d'état ou de survol — une pulsation ne s'animerait donc pas.
- `styles.css` : `canvas { cursor: crosshair; }` global, statique.
- `App.jsx` dispose déjà de `hoveredHex`, `hoveredUnitId` et `canvasRef`.

## Comportement

1. Chaque ennemi présent dans `validTargets` reçoit un **anneau rouge pulsé** (`#cc3333`)
   dessiné autour de son pion, par-dessus le cercle de l'unité. Pulsation reprenant le motif
   existant `0.5 + 0.5 * Math.sin(Date.now() / 150)` (opacité et/ou rayon).
2. La pulsation est **continue** tant qu'au moins une cible est surlignée : la boucle `rAF` de
   `App.jsx` doit rester active quand `state.validTargets` est non vide (comme pour `aiPreview`).
3. Le **curseur** passe en `pointer` (main « cliquable ») au survol d'un ennemi ciblable, pour
   confirmer qu'il est sélectionnable ; il reprend `crosshair` partout ailleurs.
4. Seuls les ennemis **ciblables** sont marqués. Les ennemis hors de portée ou sans ligne de
   vue restent inchangés (pas de grisé, pas de distinction supplémentaire).
5. L'anneau disparaît dès que l'unité est désélectionnée, qu'elle a attaqué, ou en fin
   d'activation (quand `validTargets` redevient vide) — aucun état nouveau à gérer, c'est dérivé.

## Hors-scope

- Distinguer visuellement les ennemis hors de portée / sans LOS (grisé) — non retenu.
- Réticule de visée superposé au survol — non retenu (l'anneau pulsé + curseur suffisent).
- Modification du fond de case rouge existant (conservé tel quel en arrière-plan).
- Tout signal sonore ou tooltip dédié à la ciblabilité.

## Impacts par couche

- `src/renderer.js` : dans la boucle `state.units.forEach`, après le tracé du pion, si
  `validTargetKeys.has(uk)`, tracer un anneau rouge pulsé autour du cercle de l'unité.
- `src/App.jsx` : ajouter `state.validTargets?.length > 0` aux conditions qui maintiennent la
  boucle `requestAnimationFrame` active (garde d'entrée, test de fin de boucle, dépendances) ;
  piloter `canvasRef.current.style.cursor` (`pointer` si l'unité survolée est une cible valide,
  sinon `crosshair`).
- `src/styles.css` : inchangé (le curseur dynamique est géré en JS ; `crosshair` reste le
  défaut). Aucun nouveau style requis a priori.

## Critères d'acceptation

- En sélectionnant une unité avec au moins un ennemi à portée, chaque ennemi attaquable est
  entouré d'un anneau rouge clairement visible qui pulse en continu.
- Aucun anneau n'apparaît sur les ennemis hors de portée ou sans ligne de vue.
- Le curseur devient une main au survol d'un ennemi ciblable, et redevient crosshair ailleurs.
- Les anneaux disparaissent à la désélection, après l'attaque, et en fin d'activation.
- La pulsation reste fluide sans bloquer les autres animations (mort, attaque, déplacement).
- `validTargets` reste l'unique source de vérité : aucun nouveau champ d'état ajouté.

## Tests

- La ciblabilité (`findValidTargets`) est déjà couverte côté logique ; cette feature est purement
  visuelle (rendu canvas + curseur), non testée unitairement.
- `tests/units.test.js` / `tests/game.test.js` : vérifier qu'aucune régression sur le calcul de
  `validTargets` n'est introduite (la suite existante doit rester verte).

## Risques / questions ouvertes

- Lisibilité de l'anneau rouge sur le pion J2 (rouge `#a03030`) : à régler en jeu (épaisseur,
  contraste, éventuel liseré clair entre pion et anneau) si le contraste est insuffisant.
- Coût de la boucle `rAF` maintenue active pendant la sélection : négligeable (un seul
  `drawScene` par frame), mais à confirmer si plusieurs cibles sont à l'écran.
