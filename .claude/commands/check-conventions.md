Analyse les modifications en cours par rapport aux conventions du projet.

1. Lis le fichier `CLAUDE.md` à la racine du projet pour charger les conventions.
2. Récupère les modifications en cours avec `git diff`, `git diff --cached` et `git status` (pour les fichiers non suivis).
3. S'il n'y a aucune modification, indique-le et arrête-toi.
4. Pour chaque convention du CLAUDE.md, vérifie si les modifications la respectent. En particulier :
   - Stack utilisée (React JSX, canvas 2D, Vite)
   - Architecture des fichiers (bon fichier modifié selon le type de changement)
   - Pas de TypeScript (y compris les nouveaux fichiers non suivis)
   - Coordonnées hex en système cube avec `hexKey()`
   - État immutable via `setState`
   - Rendu plateau dans `renderer.js` via `drawScene()`
   - Fonctions pures (hex, combat) sans import React
   - Logique métier dans les modules purs (`hex.js`, `combat.js`, `units.js`), jamais directement dans `App.jsx`
   - `App.jsx` n'orchestre que l'état React et le rendu — il appelle les fonctions pures
   - Tout nouveau champ d'état initialisé dans `initState()` de `units.js`
   - Thème clair respecté (couleurs)
   - Couleurs joueurs respectées
   - Phases de jeu cohérentes
   - Règles de combat Warhammer respectées
   - Pas d'imports inutilisés, constantes mortes ou lignes blanches superflues
5. Vérifie la cohérence tests/guide :
   - Si du code a été modifié dans `src/`, des tests correspondants ont-ils été ajoutés ou mis à jour ?
   - Si un terrain, une unité ou une arme a été ajouté(e), `src/Guide.jsx` a-t-il été mis à jour ?
6. Lance les tests avec `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run` et vérifie qu'ils passent tous.
7. Produis un rapport concis :
   - Liste chaque convention vérifiée avec un statut (OK / VIOLATION / N/A)
   - Détaille les violations éventuelles avec le code concerné
   - Indique le résultat des tests (tous passent / échecs détaillés)
   - Termine par un verdict global
