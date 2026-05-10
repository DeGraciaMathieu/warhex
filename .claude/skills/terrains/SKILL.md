---
name: terrains
description: Use when modifying terrain mechanics, movement rules, line of sight, pathfinding, or adding new terrain types in the warhex project
auto_invoke: true
---

# Terrains - Warhex

## Types de terrain

| Terrain | Mouvement | Ligne de vue | Effet special |
|---------|-----------|--------------|---------------|
| **Obstacles** | Bloquent (infranchissable) | Bloquent | - |
| **Rivieres** | Entrer stoppe le mouvement | Ne bloquent pas | - |
| **Villes** | Entrer stoppe le mouvement | Bloquent | -1 au seuil de sauvegarde (cover bonus) |
| **Forets** | Coutent 2 PM au lieu de 1 | Bloquent (sauf depuis/vers) | Generees en 3 zones contigues de 2-5 hexes |
| **Collines** | Coutent 2 PM au lieu de 1 | Ne bloquent pas | +1 portee armes a distance si tireur sur colline |
| **Marais** | Entrer stoppe le mouvement | Ne bloquent pas | 1 degat poison a l'entree |

## Implementation

### Mouvement (`hex.js` - `reachableHexes()`)

3 categories de clefs hexagonales :
- `obstacleKeys` — hexes totalement bloques (obstacles)
- `stopKeys` — hexes qui stoppent le mouvement du tour (rivieres, villes, marais)
- `costKeys` — hexes a cout double (forets, collines)

### Ligne de vue (`hex.js` - `hasLineOfSight()`)

Trace une ligne hex entre source et cible. Bloquee par les hexes intermediaires presents dans le set de blocage.

En `game.js`, le set de blocage LOS est construit via `buildLosKeys()` :
```js
const losKeys = new Set([...s.obstacles, ...(s.towns || []), ...(s.forests || [])].map(hexKey));
```

### Generation (`units.js` - `initState()`)

- Obstacles : 9 hexes aleatoires
- Riviere : 3-5 plans d'eau contigus via `generateWaterBodies()`
- Villes : 4 hexes aleatoires via `randomAvailableHexes()`
- Forets : 3 zones contigues via `generateForests()`
- Collines : 4 hexes aleatoires via `randomAvailableHexes()`
- Marais : 4 hexes aleatoires via `randomAvailableHexes()`

Les terrains sont generes sequentiellement, chaque type reserve ses hexes pour eviter les chevauchements.

### Rendu (`renderer.js`)

Chaque terrain a son propre style de rendu dans `drawScene()`.

## Ajouter un nouveau terrain

1. Ajouter la generation dans `initState()` de `units.js`
2. Ajouter le champ dans l'objet state retourne par `initState()`
3. Gerer l'effet mouvement dans `reachableHexes()` de `hex.js` (obstacle, stop, ou cout)
4. Si bloque la LOS : ajouter au set dans `buildLosKeys()` de `game.js`
5. Ajouter le rendu dans `renderer.js`
6. Si effet combat : modifier `resolveAttack()` dans `combat.js`
