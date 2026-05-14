---
name: testing
description: Use when writing, modifying, or debugging tests in the warhex project
auto_invoke: true
---

# Tests - Warhex

## Commande

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run
```

## Philosophie

- Tests **macro uniquement** : on teste le comportement fonctionnel, pas les details d'implementation
- Utiliser les fonctions exportees comme un utilisateur du module le ferait
- Pas de mocks sauf necessite absolue

## Fichiers de test

| Fichier | Perimetre |
|---------|-----------|
| `tests/hex.test.js` | Distances, conversions hex/pixel, voisins, ligne de vue |
| `tests/terrain.test.js` | Effets de mouvement/LOS des terrains (obstacles, rivieres, villes, forets, marais) |
| `tests/combat.test.js` | Resolution d'attaque, PA, sauvegarde, competences |
| `tests/units.test.js` | Creation d'unites, etat initial, generation de la carte |
| `tests/scoring.test.js` | Controle de villes, victoire, systeme de points |
| `tests/game.test.js` | Logique de jeu (selection, deplacement, attaque, fin de tour, collines, marais) |
| `tests/ai.test.js` | IA (selection d'unite, deplacement, attaque, choix d'arme) |

## Ou placer un nouveau test

- Maths hex → `hex.test.js`
- Effet d'un terrain → `terrain.test.js`
- Mecanique de combat → `combat.test.js`
- Nouveau type d'unite → `units.test.js`
- Scoring / victoire → `scoring.test.js`
- Flux de jeu complet → `game.test.js`
- Comportement IA → `ai.test.js`
