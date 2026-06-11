---
name: architecture
description: Use when needing to understand file structure, module responsibilities, or where to place new code in the warhex project
auto_invoke: true
---

# Architecture - Warhex

## Structure des fichiers

```
main.jsx              → Point d'entree, re-exporte App
src/
  hex.js              → Maths hexagonales (coordonnees cube, pathfinding, distance, ligne de vue)
  combat.js           → Resolution de combat (jets de des, To Hit / Save / degats)
  units.js            → Templates d'unites, factory createUnit(), etat initial (unites + obstacles)
  game.js             → Logique de jeu pure (handleClick, computeMove, computeAttack, endTurn…)
  renderer.js         → Rendu canvas (grille, obstacles, unites, barres de vie)
  styles.css          → Styles CSS (boutons, des, animations)
  App.jsx             → Composant React (state, effets, rendu UI)
  ai.js               → IA basique pour le joueur 2 (computeAIAction)
  online.js           → Mode en ligne : connexion P2P PeerJS (hostGame/joinGame), codes de partie
  Guide.jsx           → Page guide (unites, terrains, regles, schemas hex)
```

## Responsabilites par module

| Module | Role | Importe React ? |
|--------|------|-----------------|
| `hex.js` | Maths hex pures (coordonnees, distances, pathfinding, LOS) | Non |
| `combat.js` | Resolution de combat (To Hit, Save, degats) | Non |
| `units.js` | Templates d'unites, `createUnit()`, `initState()` | Non |
| `game.js` | Logique de jeu (gestion des clics, transitions de phase, fin de tour) | Non |
| `ai.js` | IA du joueur 2, importe `hex.js` et `combat.js` | Non |
| `online.js` | Mode en ligne : glue PeerJS (hote/invite) + regles pures (codes, protocole de messages, verrou de tour, application des degats) | Non |
| `renderer.js` | Rendu canvas 2D du plateau, unites, terrains | Non |
| `App.jsx` | Orchestration React : state, effets, rendu UI | Oui |
| `Guide.jsx` | Page de documentation in-game | Oui |

## Ou placer du nouveau code

- **Nouveau type d'unite** → template dans `src/units.js`
- **Nouvelle mecanique de combat** → `src/combat.js`
- **Nouvel obstacle / terrain** → generation dans `initState()` de `src/units.js`
- **Nouveau type de terrain (validation)** → `src/hex.js` + rendu dans `src/renderer.js`
- **IA** → `src/ai.js`
- **Reseau / mode en ligne** → regles pures (protocole, verrou de tour, degats) dans `src/online.js` ; `App.jsx` ne fait qu'appliquer leurs effets aux setters React
- **Animations** → `src/renderer.js`
- **Nouveau panneau UI** → `src/App.jsx`
- **Nouveau terrain, unite ou regle** → mettre a jour `src/Guide.jsx`
