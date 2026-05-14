---
name: game-rules
description: Use when modifying game phases, turn logic, activation system, combat resolution, scoring, or AI behavior in the warhex project
auto_invoke: true
---

# Regles de jeu - Warhex

## Phases de jeu

`select` → `move` → `select` → `attack` → `weapon_select` → `select`

Chaque tour, un joueur active **deux unites** (`ACTIVATIONS_PER_TURN = 2`), une a la fois (deplacement et/ou attaque chacune). Apres chaque activation, le joueur peut selectionner une autre unite non encore activee (`activatedUnitIds`). Le tour passe a l'adversaire apres la 2e activation ou si aucune unite n'est disponible. Le passage automatique se fait apres une attaque (delai 1.2s) ou apres un deplacement sans cibles disponibles.

## Regles de combat (Warhammer simplifie)

1. **To Hit** : jet >= competence (CC ou CT selon type d'arme)
2. **Sauvegarde** : 3 des, jet >= (save - coverBonus + |PA|), impossible si > 6
3. **Degats** : touches non sauvees x damage

## IA (joueur 2)

Ordre de priorite dans `computeAIAction` :
1. **Capturer une ville prioritaire** — si une ville atteignable est non possedee ou menacee par un ennemi, l'IA s'y deplace avant toute attaque
2. **Attaquer** — cible les ennemis sur les villes en priorite, puis les plus faibles
3. **Se deplacer** — vers la ville prioritaire la plus proche, ou a defaut vers l'ennemi

Une ville possedee et non menacee est ignoree (l'IA ne gaspille pas de mouvement pour la defendre).
