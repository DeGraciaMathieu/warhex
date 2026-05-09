---
name: weapons
description: Use when modifying weapon mechanics, combat resolution, unit profiles, attack stats, or adding new weapons in the warhex project
auto_invoke: true
---

# Armes - Warhex

## Proprietes d'une arme

| Propriete | Description |
|-----------|-------------|
| `id` | Identifiant unique |
| `name` | Nom affiche |
| `type` | `ranged` (distance) ou `melee` (corps a corps) |
| `range` | Portee en hexes |
| `attacks` | Nombre de des lances au To Hit |
| `strength` | Force (non utilise actuellement dans la resolution) |
| `ap` | Penetration d'armure (negatif, reduit la sauvegarde adverse) |
| `damage` | Degats par touche non sauvee |

## Armes existantes

### Warrior
| Arme | Type | Portee | Attaques | AP | Degats |
|------|------|--------|----------|----|--------|
| Rifle | ranged | 2 | 2 | -1 | 1 |
| Sword | melee | 1 | 3 | 0 | 1 |

### Knight
| Arme | Type | Portee | Attaques | AP | Degats |
|------|------|--------|----------|----|--------|
| Lance | melee | 1 | 2 | -1 | 1 |

### Sniper
| Arme | Type | Portee | Attaques | AP | Degats |
|------|------|--------|----------|----|--------|
| Sniper Rifle | ranged | 4 | 1 | -2 | 2 |
| Pistol | ranged | 1 | 1 | 0 | 1 |

### Berserker
| Arme | Type | Portee | Attaques | AP | Degats |
|------|------|--------|----------|----|--------|
| Chain Axe | melee | 1 | 4 | -1 | 1 |

## Resolution de combat (`combat.js` - `resolveAttack()`)

1. **To Hit** — lance `attacks` D6, reussite sur `ballisticSkill+` (ranged) ou `weaponSkill+` (melee)
2. **Save** — le defenseur lance 3 D6, seuil = `save - coverBonus + |AP|` (impossible si > 6)
3. **Degats** — touches non sauvees x `damage`

Le `coverBonus` est passe en option (ex: villes donnent `coverBonus: 1`).

## Profil d'unite (`units.js` - `UNIT_TEMPLATES`)

Chaque unite a : `movement`, `weaponSkill`, `ballisticSkill`, `toughness`, `wounds`, `save`, et un tableau `weapons`.

## Selection d'arme (`App.jsx`)

Phase `weapon_select` : le joueur choisit parmi les armes dont la portee atteint la cible. Le type d'arme determine la stat utilisee (CC ou CT).

## Ajouter une nouvelle arme

1. Ajouter l'objet arme dans le tableau `weapons` du template dans `UNIT_TEMPLATES` de `units.js`
2. Si nouvelle mecanique de combat : modifier `resolveAttack()` dans `combat.js`
3. Le rendu du panneau armes dans `App.jsx` est automatique via le tableau `weapons`
