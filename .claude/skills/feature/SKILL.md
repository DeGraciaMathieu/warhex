---
name: feature
description: Implement the following feature: $ARGUMENTS
user_invocable: true
---

# Feature — Warhex

Tu reçois une description de feature en argument. Suis ces étapes dans l'ordre :

## 1. Comprendre la demande

- Reformule la feature en une phrase claire.
- Invoque le skill `architecture` pour identifier les fichiers impactés.
- Si la demande est ambiguë ou incomplète, pose des questions de clarification à l'utilisateur avant de coder. Exemples de points à clarifier :
  - Valeurs numériques (combien de dégâts, quelle portée, quel coût en mouvement ?)
  - Interactions avec les mécaniques existantes (bloque la LOS ? stoppe le mouvement ?)
  - Cas limites (que se passe-t-il si l'unité meurt ? si la case est déjà occupée ?)
- Ne commence l'implémentation qu'une fois que tu as suffisamment de contexte.

## 2. Implémenter

- Invoque les skills pertinents (`terrains`, `weapons`, `game-rules`) si la feature les concerne.
- Modifie uniquement les fichiers nécessaires, en suivant les conventions du CLAUDE.md.
- Respecte l'architecture : logique pure dans `hex.js`, `combat.js`, `units.js`, `game.js` — jamais dans `App.jsx`.
- Tout nouveau champ d'état doit être initialisé dans `initState()` de `units.js`.

## 3. Tester

- Invoque le skill `testing` pour savoir où placer les tests.
- Ajoute des tests **fonctionnels** (macro) qui vérifient le **comportement**, pas l'implémentation.
- Lance `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run` et corrige jusqu'à ce que tout passe.

## 4. Mettre à jour la documentation

- Mets à jour le **CLAUDE.md** si la feature change les conventions.
- Mets à jour les **skills** (`terrains`, `weapons`, `game-rules`, `architecture`, `testing`) si la feature impacte leur périmètre.
- Mets à jour **`src/Guide.jsx`** si la feature ajoute/modifie un terrain, une unité ou une règle de combat.
- Crée un nouveau skill si la feature introduit un domaine entièrement nouveau.

## 5. Résumé

- Présente un résumé des changements : fichiers modifiés, tests ajoutés, résultat des tests.
