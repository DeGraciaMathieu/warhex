Analyse complète de la feature en cours : conventions, tests, maintenabilité et cohérence système.

1. Lis le fichier `CLAUDE.md` à la racine du projet pour charger les conventions et l'architecture.
2. Récupère les modifications en cours avec `git diff`, `git diff --cached`, `git status` et `git log --oneline -5` pour comprendre le périmètre de la feature.
3. S'il n'y a aucune modification (staged, unstaged ou commits récents non pushés), indique-le et arrête-toi.

## Conventions

4. Pour chaque convention du CLAUDE.md, vérifie si les modifications la respectent. En particulier :
   - Stack utilisée (React JSX, canvas 2D, Vite)
   - Architecture des fichiers (bon fichier modifié selon le type de changement)
   - Pas de TypeScript
   - Coordonnées hex en système cube avec `hexKey()`
   - État immutable via `setState`
   - Rendu plateau dans `renderer.js` via `drawScene()`
   - Fonctions pures (hex, combat) sans import React
   - Logique métier dans les modules purs (`hex.js`, `combat.js`, `units.js`), jamais directement dans `App.jsx`
   - `App.jsx` n'orchestre que l'état React et le rendu
   - Tout nouveau champ d'état initialisé dans `initState()` de `units.js`
   - Thème clair et couleurs joueurs respectés
   - Pas d'imports inutilisés, constantes mortes ou lignes blanches superflues

## Tests

5. Vérifie la couverture de tests :
   - Chaque nouveau comportement ajouté dans `src/` a-t-il un test correspondant dans `tests/` ?
   - Les tests existants sont-ils à jour avec les modifications ?
   - Les tests sont bien macro (comportement fonctionnel, pas détails d'implémentation)
   - Si un terrain, une unité ou une arme a été ajouté(e), `src/Guide.jsx` a-t-il été mis à jour ?
6. Lance les tests avec `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run` et vérifie qu'ils passent tous.

## Maintenabilité et dette technique

7. Analyse les modifications sous l'angle maintenabilité :
   - **Couplage** : les modifications introduisent-elles des dépendances circulaires ou un couplage fort entre modules ?
   - **Responsabilité unique** : chaque fonction/module modifié garde-t-il une responsabilité claire ?
   - **Duplication** : y a-t-il du code dupliqué qui devrait être factorisé ?
   - **Complexité** : des fonctions deviennent-elles trop longues ou trop imbriquées (> 40 lignes, > 3 niveaux d'indentation) ?
   - **Nommage** : les noms de variables, fonctions et fichiers sont-ils explicites et cohérents avec l'existant ?
   - **Magic values** : des valeurs en dur qui devraient être des constantes nommées ?

## Cohérence système

8. Vérifie la cohérence globale :
   - Les modifications s'intègrent-elles bien avec le reste du système (pas d'incohérence de données, de phases, de flow) ?
   - Le state shape reste-t-il cohérent et prévisible ?
   - Les nouvelles fonctions suivent-elles les patterns existants (signatures, retours, gestion d'erreurs) ?

## Rapport

9. Produis un rapport structuré :
   - **Conventions** : statut par convention (OK / VIOLATION / N/A)
   - **Tests** : résultat des tests + couverture manquante identifiée
   - **Maintenabilité** : problèmes détectés avec le code concerné
   - **Cohérence** : incohérences ou risques identifiés
   - **Verdict** : résumé en une phrase + liste d'actions correctives si nécessaire
