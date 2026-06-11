---
name: game-rules
description: Use when modifying game phases, turn logic, activation system, combat resolution, scoring, or AI behavior in the warhex project
auto_invoke: true
---

# Regles de jeu - Warhex

## Phases de jeu

`select` → `move` → `select` → `attack` → `weapon_select` → `select`

Chaque tour, un joueur active **deux unites** (`ACTIVATIONS_PER_TURN = 2`), une a la fois (deplacement et/ou attaque chacune). Apres chaque activation, le joueur peut selectionner une autre unite non encore activee (`activatedUnitIds`). Le tour passe a l'adversaire apres la 2e activation ou si aucune unite n'est disponible. Le passage automatique se fait apres une attaque (delai 1.2s) ou apres un deplacement sans cibles disponibles.

**Consolidation** : apres un kill au corps a corps adjacent, une phase `consolidate` s'intercale avant la fin d'activation — l'attaquant peut prendre la place de l'unite tuee (`computeConsolidate(state, accept)` dans `game.js`, etat `pendingConsolidation`). Les effets de terrain a l'arrivee s'appliquent (capture de ville, poison du marais). La fin d'activation (et l'`autoEndTurn`) n'a lieu qu'apres le choix.

## Regles de combat (Warhammer simplifie)

1. **To Hit** : jet >= competence (CC ou CT selon type d'arme)
2. **Sauvegarde** : 3 des, jet >= (save - coverBonus + |PA|), impossible si > 6
3. **Degats** : touches non sauvees x damage

## IA (joueur 2)

Ordre de priorite dans `computeAIAction` :
1. **Capturer une ville prioritaire** — si une ville atteignable est non possedee ou menacee par un ennemi, l'IA s'y deplace avant toute attaque
2. **Se repositionner** — si un deplacement ameliore l'attaque esperee (meilleure arme, colline pour la portee, couvert), l'IA bouge avant de tirer (une attaque termine l'activation, le mouvement vient donc toujours avant)
3. **Attaquer** — cible les ennemis sur les villes en priorite, puis ceux tuables en esperance, puis ceux aux degats esperes les plus eleves (PV les plus bas en departage)
4. **Se deplacer** — vers la ville prioritaire la plus proche, sinon meilleure position de tir (`attackScoreFrom`, exposition `threatAt` en departage — securite d'abord a 1 PV), sinon avancer vers l'ennemi ; une unite a 1 PV sans tir possible fuit hors de portee des menaces

Une ville possedee et non menacee est ignoree (l'IA ne gaspille pas de mouvement pour la defendre).

En phase `consolidate`, l'IA decide via `shouldConsolidate(unit, hex, state)` (`ai.js`) : accepte si l'hex libere est une ville (capture), refuse si c'est un marais (poison), sinon accepte seulement si l'hex libere est moins expose (`threatAt`).

Le choix de cible et d'arme repose sur `expectedDamage(attacker, weapon, target, { coverBonus, penalty })` (`combat.js`) : esperance exacte des degats (lois binomiales sur to-hit et sauvegardes), integrant CC/CT, PA, couvert (ville/foret) et penalite riviere. L'arme retenue maximise l'esperance plafonnee aux PV restants de la cible (anti-overkill). `threatAt` estime les degats que les ennemis peuvent infliger a un hex au tour suivant (mouvement + portee, terrain ignore).
