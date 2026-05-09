Vérifie la couverture de tests et crée les tests manquants.

Les tests doivent être de **haut niveau** (macro) : ils vérifient le comportement fonctionnel du jeu, pas les détails d'implémentation. On teste "ce que fait le système" et non "comment il le fait".

1. Lis les fichiers sources dans `src/` pour identifier les fonctionnalités du jeu.
2. Lis les tests existants dans `tests/` pour identifier ce qui est déjà couvert.
3. Compare les fonctionnalités aux tests existants et identifie les manques.
4. Pour chaque manque identifié, crée les tests dans le fichier approprié de `tests/`.
5. Les tests doivent :
   - Vérifier des comportements macro (ex: "un tir hors portée ne fait pas de dégâts", "une unité morte ne peut plus agir")
   - Ne PAS tester les détails internes (ex: valeurs intermédiaires, structure des objets retournés)
   - Utiliser les fonctions exportées comme un utilisateur du module le ferait
   - Être concis et lisibles
6. Lance les tests avec `npx vitest run` et corrige les erreurs éventuelles.
7. Produis un rapport :
   - Fonctionnalités couvertes avant / après
   - Tests ajoutés
   - Résultat final des tests
