# PRD 03 — Annulation du choix de cible (rechoisir une cible)

**Priorité : 1 — Impact ★★★ — Effort faible**

## Objectif

Quand le joueur sélectionne une cible d'attaque, le jeu ouvre le choix d'arme.
S'il se trompe de cible, le seul moyen de la changer est aujourd'hui de
re-sélectionner l'unité depuis le plateau : le bouton « Annuler » existant vide
la liste des cibles et laisse l'unité sélectionnée sans aucune cible affichée.
On veut que « Annuler » ramène simplement à l'état « cible à choisir », pour
rechoisir une autre cible immédiatement.

## Existant technique

- `src/game.js` `handleClick` (lignes ~141-143) : cliquer une cible valide en
  phase `select`/`attack` passe en phase `weapon_select` avec
  `pendingAttack: { attacker, target }`. **`validTargets`, `validMoves` et
  `attackRangeHexes` ne sont PAS effacés** à ce moment : ils restent dans l'état.
- `src/App.jsx` (ligne ~970) : le bouton « ✕ Annuler » du modal d'arme fait
  `applyAction(s => ({ ...s, phase: "select", pendingAttack: null, validTargets: [], validMoves: [] }))`.
  C'est lui qui **vide `validTargets`/`validMoves`** — d'où l'impossibilité de
  rechoisir une cible sans re-sélectionner l'unité. `attackRangeHexes` n'est même
  pas remis à zéro (incohérence résiduelle). Cette logique métier est écrite en
  ligne dans le JSX, ce qui contrevient à la convention « toute logique métier
  dans des fonctions pures de `game.js`, jamais dans `App.jsx` ».
- La sélection d'une unité (`handleClick` lignes ~171-182) calcule déjà
  `validMoves` (`[]` si `hasMoved`), `validTargets` (`findValidTargets` avec bonus
  de portée si colline) et `attackRangeHexes`. La ré-affichage des cibles après
  annulation doit produire exactement le même état que cette sélection, mais pour
  l'attaquant courant (qui peut avoir déjà bougé).
- `src/App.jsx` `applyAction` (lignes ~142-145) renvoie l'état et, en ligne,
  diffuse l'état complet (`type: "state"`). Une annulation se resynchronise donc
  sans traitement réseau spécifique.
- Hors-scope confirmé côté code : l'annulation d'un **déplacement** n'est pas
  traitée (le flux d'activation `finishActivation` n'est pas modifié).

## Comportement

1. En phase `weapon_select`, le bouton « ✕ Annuler » annule le choix de cible :
   - `pendingAttack` repasse à `null` ;
   - la phase repasse à `select` ;
   - `validTargets`, `validMoves` et `attackRangeHexes` sont **recalculés** pour
     l'attaquant courant, à l'identique de la sélection de cette unité.
2. L'attaquant reste l'unité sélectionnée (`selectedUnit` / `activeUnitId`
   inchangés). Le joueur peut alors cliquer une autre cible, ou désélectionner.
3. Si l'attaquant a déjà bougé (`hasMoved`), `validMoves` reste vide ; les cibles
   et la portée sont recalculées depuis sa position actuelle (avec bonus de
   colline éventuel), comme à la sélection.
4. Aucune ressource n'est consommée par l'annulation : aucun incrément
   d'activation, `hasMoved`/`hasAttacked` inchangés.
5. La logique d'annulation est extraite dans une fonction pure exportée de
   `src/game.js` (ex. `computeCancelAttack(s)`) ; `App.jsx` se contente de
   l'appeler via `applyAction`.

## Hors-scope

- **Annulation d'un déplacement** : retirée du périmètre à la demande, le flux
  d'activation (`finishActivation`, effets d'arrivée marais/ville) n'est pas
  modifié. Pourra faire l'objet d'un PRD ultérieur.
- **Annulation après résolution d'attaque** : une fois les dés lancés et les
  dégâts appliqués (`phase: "resolving"` / `applyDamage`), l'attaque est
  définitive.
- **Annulation de la consolidation** : la phase `consolidate` conserve son propre
  choix accepter/rester.
- **Historique multi-étapes** : on ne gère que l'annulation du choix de cible en
  cours, pas une pile d'actions.

## Impacts par couche

- `src/game.js` : ajout d'une fonction pure `computeCancelAttack(s)` qui, à partir
  de `pendingAttack.attacker` (ou `selectedUnit`), recalcule `validMoves`,
  `validTargets`, `attackRangeHexes` (réutilise la même logique que la branche de
  sélection d'unité, idéalement factorisée), remet `phase: "select"` et
  `pendingAttack: null`.
- `src/App.jsx` : le bouton « ✕ Annuler » du modal d'arme appelle
  `applyAction(computeCancelAttack)` au lieu de l'objet inline qui vide les
  listes.

## Critères d'acceptation

- Après avoir choisi une cible puis cliqué « Annuler », les cibles valides sont à
  nouveau surlignées et cliquables sans re-sélectionner l'unité.
- Cliquer une autre cible après annulation rouvre le choix d'arme sur cette
  nouvelle cible.
- L'état obtenu après annulation est identique à celui d'une sélection fraîche de
  l'attaquant (mêmes `validMoves`/`validTargets`/`attackRangeHexes`,
  `attackRangeHexes` cohérent et non résiduel).
- `activationsUsed`, `activatedUnitIds`, `hasMoved`, `hasAttacked` sont inchangés
  par l'annulation.
- En partie en ligne, l'annulation se propage à l'adversaire via la diffusion
  d'état existante, sans message spécifique.

## Tests

- `tests/game.test.js` :
  - après `handleClick` sur une cible (phase `weapon_select`), `computeCancelAttack`
    redonne `phase: "select"`, `pendingAttack: null` et des `validTargets`
    non vides correspondant aux cibles à portée de l'attaquant ;
  - l'état renvoyé par `computeCancelAttack` est équivalent à une nouvelle
    sélection de l'attaquant (mêmes clés de `validTargets`/`validMoves`/`attackRangeHexes`) ;
  - aucun champ d'activation (`activationsUsed`, `activatedUnitIds`) ni
    `hasMoved`/`hasAttacked` n'est modifié ;
  - cas d'un attaquant ayant déjà bougé : `validMoves` reste vide, les cibles sont
    recalculées depuis sa position.

## Risques / questions ouvertes

- Effort revu à la baisse (de « moyen » à « faible ») suite au retrait de
  l'annulation de déplacement : il ne reste qu'une fonction pure et le câblage
  d'un bouton existant.
- Veiller à factoriser la recomputation des cibles avec la branche de sélection
  d'unité de `handleClick` pour éviter une duplication qui pourrait diverger
  (bonus de colline, LOS, couverture).
