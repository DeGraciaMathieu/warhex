# Warhex

Jeu tactique tour par tour sur grille hexagonale, inspiré des mécaniques Warhammer 40k.

## Stack

- React (JSX, pas de TypeScript)
- Rendu canvas 2D (pas de librairie graphique)
- Vite en dev server (`npx vite`)
- Node.js 22+ requis (`nvm use 22`)
- Tests : `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run`

## Conventions de code

- Pas de TypeScript
- Coordonnées hex en système cube (q + r + s = 0), toujours utiliser `hexKey()` pour les clés
- L'état du jeu est un objet immutable passé via `setState`
- Le rendu du plateau se fait dans `renderer.js` via `drawScene(canvas, state, hoveredHex)`
- Les fonctions pures (hex, combat) n'importent jamais React
- Toute logique métier (scoring, victoire, terrain) doit être dans des fonctions pures exportées, jamais directement dans `App.jsx`
- `App.jsx` ne fait qu'orchestrer l'état React et le rendu — il appelle les fonctions pures
- Tout nouveau champ d'état doit être initialisé dans `initState()` de `units.js`

## Conventions visuelles

- Thème clair (fond beige `#f5f0e8`, texte foncé `#2a2015`)
- Couleurs joueurs : bleu `#2a6fa8` (J1), rouge `#a03030` (J2)

## Skills disponibles

- `terrains` — types de terrain, mouvement, LOS, ajout de terrain
- `weapons` — armes, profils d'unités, résolution de combat
- `architecture` — structure des fichiers, responsabilités, où placer du code
- `game-rules` — phases de jeu, règles de combat, comportement IA
- `testing` — philosophie de test, fichiers de test, où placer un test
- `feature` — workflow complet pour implémenter une feature
