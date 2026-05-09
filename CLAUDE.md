# Hex Warhammer

Jeu tactique tour par tour sur grille hexagonale, inspiré des mécaniques Warhammer 40k.

## Stack

- React (JSX, pas de TypeScript)
- Rendu canvas 2D (pas de librairie graphique)
- Vite en dev server (`npx vite`)
- Node.js 22+ requis (`nvm use 22`)
- Tests : `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run`

## Architecture

```
main.jsx              → Point d'entrée, ré-exporte App
src/
  hex.js              → Maths hexagonales (coordonnées cube, pathfinding, distance, ligne de vue)
  combat.js           → Résolution de combat (jets de dés, To Hit / Save / dégâts)
  units.js            → Templates d'unités, factory createUnit(), état initial (unités + obstacles)
  game.js             → Logique de jeu pure (handleClick, computeMove, computeAttack, endTurn…)
  renderer.js         → Rendu canvas (grille, obstacles, unités, barres de vie)
  styles.css          → Styles CSS (boutons, dés, animations)
  App.jsx             → Composant React (state, effets, rendu UI)
  ai.js               → (à créer) IA basique pour le joueur 2
```

## Conventions

- Pas de TypeScript
- Coordonnées hex en système cube (q + r + s = 0), toujours utiliser `hexKey()` pour les clés
- L'état du jeu est un objet immutable passé via `setState`
- Le rendu du plateau se fait dans `renderer.js` via `drawScene(canvas, state, hoveredHex)`
- Les fonctions pures (hex, combat) n'importent jamais React
- Thème clair (fond beige `#f5f0e8`, texte foncé `#2a2015`)
- Couleurs joueurs : bleu `#2a6fa8` (J1), rouge `#a03030` (J2)
- Terrains (obstacles, rivières, villes, forêts) et armes : voir skills `terrains` et `weapons`

## Phases de jeu

`select` → `move` → `select` → `attack` → `weapon_select` → `select`

Chaque tour, un joueur agit avec **une seule unité** (déplacement et/ou attaque), puis le tour passe automatiquement à l'adversaire. Une fois qu'une unité a agi, on ne peut pas en sélectionner une autre (`activeUnitId`). Le passage automatique se fait après une attaque (délai 1.2s) ou après un déplacement sans cibles disponibles (délai 0.8s).

## Règles de combat (Warhammer simplifié)

1. **To Hit** : jet >= compétence (CC ou CT selon type d'arme)
2. **Sauvegarde** : 3 dés, jet >= (save - coverBonus + |PA|), impossible si > 6
3. **Dégâts** : touches non sauvées × damage

## Conventions de code

- Toute logique métier (scoring, victoire, terrain) doit être dans des fonctions pures exportées (`hex.js`, `combat.js`, `units.js`), jamais directement dans `App.jsx`
- `App.jsx` ne fait qu'orchestrer l'état React et le rendu — il appelle les fonctions pures
- Tout nouveau champ d'état doit être initialisé dans `initState()` de `units.js`

## Tests

- Fichier : `tests/mechanics.test.js`
- Commande : `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run`
- Tests macro uniquement : on teste le comportement fonctionnel, pas les détails d'implémentation
- Utiliser les fonctions exportées comme un utilisateur du module le ferait

## Pour ajouter une feature

- **Nouveau type d'unité** → ajouter le template dans `src/units.js`
- **Nouvelle mécanique de combat** → modifier `src/combat.js`
- **Nouvel obstacle** → ajouter les coordonnées dans `initState()` de `src/units.js`
- **Nouveau type de terrain** → modifier `src/hex.js` (validation) + `src/renderer.js` (affichage)
- **IA** → créer `src/ai.js`, importer les fonctions de `hex.js` et `combat.js`
- **Animations** → modifier `src/renderer.js`
- **Nouveau panneau UI** → modifier `src/App.jsx`
