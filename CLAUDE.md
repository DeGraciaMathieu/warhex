# Hex Warhammer

Jeu tactique tour par tour sur grille hexagonale, inspiré des mécaniques Warhammer 40k.

## Stack

- React (JSX, pas de TypeScript)
- Rendu canvas 2D (pas de librairie graphique)
- Vite en dev server (`npx vite`)

## Architecture

```
main.jsx              → Point d'entrée, ré-exporte App
src/
  hex.js              → Maths hexagonales (coordonnées cube, pathfinding, distance, ligne de vue)
  combat.js           → Résolution de combat (jets de dés, To Hit / Save / multiplicateur Force vs Endurance)
  units.js            → Templates d'unités, factory createUnit(), état initial (unités + obstacles)
  renderer.js         → Rendu canvas (grille, obstacles, unités, barres de vie)
  App.jsx             → Composant React principal (state, handlers, UI panneau droit)
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
- Obstacles stockés dans `state.obstacles`, bloquent le déplacement et la ligne de vue
- Ligne de vue calculée par `hasLineOfSight()` dans `hex.js` (tracé de ligne hex)

## Phases de jeu

`select` → `move` → `select` → `attack` → `weapon_select` → `select`

Chaque unité peut se déplacer une fois et attaquer une fois par tour.

## Règles de combat (Warhammer simplifié)

1. **To Hit** : jet >= compétence (CC ou CT selon type d'arme)
2. **Sauvegarde** : jet >= (save + |PA|), impossible si > 6
3. **Dégâts** : touches non sauvées × damage × `damageMultiplier(force, endurance)`

## Pour ajouter une feature

- **Nouveau type d'unité** → ajouter le template dans `src/units.js`
- **Nouvelle mécanique de combat** → modifier `src/combat.js`
- **Nouvel obstacle** → ajouter les coordonnées dans `initState()` de `src/units.js`
- **Nouveau type de terrain** → modifier `src/hex.js` (validation) + `src/renderer.js` (affichage)
- **IA** → créer `src/ai.js`, importer les fonctions de `hex.js` et `combat.js`
- **Animations** → modifier `src/renderer.js`
- **Nouveau panneau UI** → modifier `src/App.jsx`
