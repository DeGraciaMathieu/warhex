# Warhex

Jeu tactique tour par tour sur grille hexagonale, inspiré des mécaniques Warhammer 40k.

## Prérequis

- Node.js 20.19+ ou 22.12+

## Lancement

```bash
npm install
npx vite
```

Ouvre `http://localhost:5173` dans ton navigateur.

## Harness de simulation

Un harness headless joue en masse des parties IA contre IA pour récolter des
statistiques d'équilibrage. Il se trouve dans `harness/` et n'importe que les
fonctions pures du jeu (`src/game.js`, `src/ai.js`, `src/units.js`) — il n'a
aucun impact sur le comportement du jeu.

```bash
node harness/run.js [N]   # N parties par matchup, défaut 300
```

Exemple :

```bash
node harness/run.js 500
```

### Sortie

Pour chaque matchup, il affiche les taux de victoire (J1 / J2 / nul), le nombre
moyen de rounds, l'écart de score moyen, le nombre moyen de villes contrôlées,
ainsi que la survie et les kills par type d'unité :

```
═══ Miroir standard — terrain par défaut ═══  (300 parties, 0 avortées)
  Victoires   J1  38.0%   J2  51.0%   Nul  11.0%
  Rounds moy 7.0   Écart score moy 5.5   Villes moy J1 2.3 / J2 2.7
  Unité         Survie  Kills/partie
  Warrior        76.5%          1.88
  ...
```

### Fonctionnement

- **`harness/profiles.js`** — les matchups à simuler. Chaque entrée définit les
  deux armées, le terrain (`terrainDensity`, via les presets de `src/units.js`)
  et, optionnellement, des poids de décision IA alternatifs. Modifie ce fichier
  pour ajouter ou changer des matchups.
- **`harness/sim.js`** — le moteur. `runGame()` rejoue une partie complète avec
  les fonctions pures, sans React/timers/animations. Un *adaptateur de
  perspective* (`mirrorState`) permute les labels de joueur pour que l'IA —
  câblée pour jouer le joueur 2 — puisse aussi piloter le joueur 1.
- **`harness/run.js`** — la CLI : lance `N` parties par matchup, agrège et
  affiche le tableau.

Les parties utilisent `Math.random` directement (sans seed) : elles ne sont donc
pas reproductibles individuellement ; la fiabilité vient de l'agrégation sur un
grand `N`.

### Régler les stratégies IA

`computeAIAction(state, weights?)` accepte un objet de poids optionnel
(`DEFAULT_AI_WEIGHTS` dans `src/ai.js` liste les clés et leurs valeurs par
défaut, identiques au jeu). Passe `weights: { 1: {...}, 2: {...} }` dans un
matchup pour opposer différentes stratégies. Sans poids, le comportement de
l'IA du jeu reste inchangé.
