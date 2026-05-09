---
name: feature
description: Implement the following feature: $ARGUMENTS
user_invocable: true
---

# Feature — Hex Warhammer

Tu reçois une description de feature en argument. Suis ces étapes dans l'ordre :

## 1. Comprendre la demande

- Reformule la feature en une phrase claire.
- Identifie les fichiers impactés en te basant sur le CLAUDE.md (section "Pour ajouter une feature").
- Si la demande est ambiguë ou incomplète, pose des questions de clarification à l'utilisateur avant de coder. Exemples de points à clarifier :
  - Valeurs numériques (combien de dégâts, quelle portée, quel coût en mouvement ?)
  - Interactions avec les mécaniques existantes (bloque la LOS ? stoppe le mouvement ?)
  - Cas limites (que se passe-t-il si l'unité meurt ? si la case est déjà occupée ?)
- Ne commence l'implémentation qu'une fois que tu as suffisamment de contexte.

## 2. Implémenter

- Invoque les skills pertinents (`terrains`, `weapons`) si la feature les concerne.
- Modifie uniquement les fichiers nécessaires, en suivant les conventions du CLAUDE.md.
- Respecte l'architecture : logique pure dans `hex.js`, `combat.js`, `units.js`, `game.js` — jamais dans `App.jsx`.
- Tout nouveau champ d'état doit être initialisé dans `initState()` de `units.js`.

## 3. Tester

- Ajoute des tests **fonctionnels** (macro) dans le fichier de test approprié :
  - `tests/hex.test.js` — maths hexagonales
  - `tests/terrain.test.js` — effets de terrain sur mouvement/LOS
  - `tests/combat.test.js` — résolution de combat
  - `tests/units.test.js` — unités et état initial
  - `tests/scoring.test.js` — système de points
  - `tests/game.test.js` — logique de jeu, flux complet
- Les tests vérifient le **comportement**, pas l'implémentation.
- Lance `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run` et corrige jusqu'à ce que tout passe.

## 4. Mettre à jour la documentation

- Mets à jour le **CLAUDE.md** si la feature change l'architecture, les conventions ou les phases de jeu.
- Mets à jour les **skills** (`terrains`, `weapons`) si la feature impacte leur périmètre.
- Crée un nouveau skill si la feature introduit un domaine entièrement nouveau.

## 5. Résumé

- Présente un résumé des changements : fichiers modifiés, tests ajoutés, résultat des tests.
