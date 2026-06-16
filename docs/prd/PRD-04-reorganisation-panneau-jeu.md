# PRD 04 — Réorganisation du panneau de jeu (infos de partie)

**Priorité : 2 — Impact ★★ — Effort faible**

## Objectif

En partie, le panneau « UNITÉ SÉLECTIONNÉE » (haut de la barre latérale droite)
affiche des stats détaillées (PV, MVT, CC, CT, SVG, déplacé/attaqué, profils
d'armes) que les joueurs ne lisent jamais. Pendant ce temps, l'information qui
détermine réellement la victoire — combien de villes chaque camp contrôle, et
donc les points à venir — n'est visible nulle part en cours de partie. On
récupère cet espace pour afficher des infos utiles à la décision : contrôle des
villes en temps réel et kills par joueur.

## Existant technique

- `src/App.jsx` (lignes ~733-770) : bloc « UNITÉ SÉLECTIONNÉE » dans la barre
  latérale droite (largeur 320). Affiche `sel.symbol`, `sel.name`, le joueur, un
  tableau de stats (`currentWounds/wounds`, `movement`, `weaponSkill`,
  `ballisticSkill`, `save`, `hasMoved`, `hasAttacked`) et la liste des armes
  (`sel.weapons`). `minHeight: 210`.
- `src/App.jsx` (lignes ~772-791) : bloc « ACTIONS » (Déplacer / Attaquer /
  Désélectionner / Consolidation / Fin de tour). Les boutons dépendent de `sel` :
  ce bloc et la variable `sel` (ligne ~661) doivent être conservés.
- `src/App.jsx` (lignes ~689-702) : barre d'état sous le canvas affichant déjà
  joueur courant + phase + activations restantes, et scores cumulés + tour.
- `src/units.js` `computeTownControl(townOwnership)` (lignes 141-148) : fonction
  pure déjà exportée renvoyant `{ 1: nbVilles, 2: nbVilles }`. Utilisée seulement
  en fin de tour (`computeEndTurn`) pour le score ; jamais affichée en direct.
- État disponible et déjà initialisé (`initState`) : `state.townOwnership` (`{}`),
  `state.kills` (`{ 1: 0, 2: 0 }`). Les kills ne sont affichés qu'à l'écran de
  fin (lignes ~715/722).
- `src/renderer.js` : chaque pion dessine déjà une barre de PV (ratio de
  `currentWounds`), donc supprimer le panneau ne supprime pas l'information de PV
  de l'unité sélectionnée — elle reste lisible sur le plateau.
- Les stats d'arme restent accessibles dans le modal de combat (`WeaponCard`,
  lignes ~932-933) au moment d'attaquer.

## Comportement

1. Le bloc « UNITÉ SÉLECTIONNÉE » (nom, stats détaillées, profils d'armes) est
   supprimé de la barre latérale.
2. À sa place, en haut de la barre latérale, un bloc « INFOS DE PARTIE » affiche
   pour chaque joueur (couleurs J1 `#2a6fa8` / J2 `#a03030`) :
   - **Villes contrôlées** : valeur issue de `computeTownControl(state.townOwnership)`,
     mise à jour en temps réel à chaque capture.
   - **Kills** : `state.kills[1]` / `state.kills[2]`.
3. Le bloc « ACTIONS » est conservé tel quel et reste fonctionnel (dépendances à
   `sel`, consolidation, fin de tour inchangées).
4. Aucune nouvelle donnée d'état : la feature ne fait que lire `townOwnership` et
   `kills` existants via une fonction pure déjà présente.
5. Le rendu reste cohérent avec le thème clair existant (pas de nouvelle palette).

## Hors-scope

- **Journal d'événements persistant** : pas de log des actions récentes ; aucun
  nouvel historique stocké dans l'état (PRD ultérieur si souhaité).
- **Refonte visuelle / thème** : couleurs, polices et structure générale (canvas
  à gauche, barre latérale à droite) inchangés ; on remplace seulement le contenu
  d'un bloc.
- **Écran de fin de partie** : le récapitulatif de victoire (kills + `ScoreChart`)
  reste inchangé.
- **Tooltip de stats au survol** : pas de réintroduction des stats d'unité sous
  forme d'infobulle au survol sur le plateau.

## Impacts par couche

- `src/App.jsx` :
  - suppression du bloc JSX « UNITÉ SÉLECTIONNÉE » (~733-770) ;
  - ajout d'un bloc « INFOS DE PARTIE » lisant `computeTownControl(state.townOwnership)`
    et `state.kills` ;
  - import de `computeTownControl` depuis `./units.js` ;
  - conservation de `sel` (utilisé par le bloc ACTIONS) ; suppression d'éventuels
    styles/CSS devenus inutilisés (classes `sr`/`sl`/`sv` si plus référencées
    ailleurs).
- `src/units.js` : aucun changement (fonction `computeTownControl` réutilisée).

## Critères d'acceptation

- En partie, la barre latérale n'affiche plus les stats détaillées ni les profils
  d'armes de l'unité sélectionnée.
- Le nombre de villes par joueur affiché correspond à
  `computeTownControl(state.townOwnership)` et se met à jour dès qu'une ville
  change de propriétaire.
- Le nombre de kills affiché correspond à `state.kills` et augmente après une
  élimination.
- Les boutons d'action (Déplacer/Attaquer/Désélectionner/Consolidation/Fin de
  tour) conservent exactement le même comportement qu'avant.
- Aucune classe CSS ni import ne reste inutilisé après la suppression.

## Tests

- `tests/scoring.test.js` : vérifier (si non déjà couvert) que
  `computeTownControl` reflète un `townOwnership` partiel en cours de partie
  (ex. 2 villes J1, 1 ville J2, cases neutres ignorées) — calcul déterministe.
- Le reste de la feature est de l'agencement JSX (non couvert par des tests
  unitaires, conformément à la philosophie « tests macro » du projet) : à valider
  visuellement via `npx vite`.

## Risques / questions ouvertes

- Perte de l'affichage textuel des PV de l'unité sélectionnée : atténuée par la
  barre de PV déjà dessinée sur les pions ; à confirmer en jeu que c'est
  suffisant.
- Place libérée (`minHeight: 210`) : décider si le bloc « INFOS DE PARTIE » occupe
  tout l'espace ou si les actions remontent — ajustement esthétique à faire à
  l'essai.
- Redondance partielle avec la barre d'état sous le canvas (scores/tour) : veiller
  à ne pas dupliquer l'information mais à la compléter (villes en direct + kills).
