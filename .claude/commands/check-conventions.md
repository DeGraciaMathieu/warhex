Analyse les modifications en cours par rapport aux conventions du projet.

1. Lis le fichier `CLAUDE.md` à la racine du projet pour charger les conventions.
2. Récupère les modifications en cours avec `git diff` et `git diff --cached`.
3. S'il n'y a aucune modification, indique-le et arrête-toi.
4. Pour chaque convention du CLAUDE.md, vérifie si les modifications la respectent. En particulier :
   - Stack utilisée (React JSX, canvas 2D, Vite)
   - Architecture des fichiers (bon fichier modifié selon le type de changement)
   - Pas de TypeScript
   - Coordonnées hex en système cube avec `hexKey()`
   - Etat immutable via `setState`
   - Rendu plateau dans `renderer.js` via `drawScene()`
   - Fonctions pures (hex, combat) sans import React
   - Thème clair respecté (couleurs)
   - Couleurs joueurs respectées
   - Phases de jeu cohérentes
   - Règles de combat Warhammer respectées
5. Produis un rapport concis :
   - Liste chaque convention vérifiée avec un statut (OK / VIOLATION / N/A)
   - Détaille les violations éventuelles avec le code concerné
   - Termine par un verdict global
