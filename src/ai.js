import { hexDistance, hexKey, reachableHexes, hasLineOfSight, pathDistance } from "./hex.js";
import { findValidTargets, expectedDamage } from "./combat.js";

// Poids de décision de l'IA. Les valeurs par défaut reproduisent à l'identique
// les constantes historiquement codées en dur dans pickBestUnit : sans argument,
// le comportement de l'IA est strictement inchangé. Le harness de simulation
// (harness/) peut passer des poids alternatifs pour comparer des stratégies.
export const DEFAULT_AI_WEIGHTS = {
    hitTownEnemy: 100, // peut frapper un ennemi posté sur une ville
    hasTargets: 10,    // a au moins une cible à portée
    captureTown: 50,   // peut atteindre une ville prioritaire ce tour
    towardTown: 20,    // se rapproche d'une ville prioritaire (divisé par la distance)
    towardEnemy: 5,    // se rapproche d'un ennemi (divisé par la distance)
};

function buildLosKeys(state) {
    return new Set([...state.obstacles, ...(state.towns || []), ...(state.forests || []), ...(state.hills || [])].map(hexKey));
}

function buildTerrainKeys(state) {
    const obsKeys = new Set(state.obstacles.map(hexKey));
    const stopKeys = new Set([...(state.rivers || []), ...(state.towns || []), ...(state.swamps || [])].map(hexKey));
    const costKeys = new Set([...(state.forests || []), ...(state.hills || [])].map(hexKey));
    return { obsKeys, stopKeys, costKeys };
}

function townContext(state) {
    const townKeys = new Set((state.towns || []).map(hexKey));
    const aliveUnits = state.units.filter(u => u.currentWounds > 0);
    const unitOnTown = new Map();
    for (const u of aliveUnits) {
        const k = hexKey(u.hex);
        if (townKeys.has(k)) unitOnTown.set(k, u);
    }
    const emptyTowns = (state.towns || []).filter(t => !unitOnTown.has(hexKey(t)));
    const enemyOnTown = [...unitOnTown.values()].filter(u => u.player === 1);

    const ownership = state.townOwnership || {};
    const { obsKeys, stopKeys, costKeys } = buildTerrainKeys(state);
    const enemies = aliveUnits.filter(u => u.player === 1);
    const occupied = new Set(aliveUnits.map(u => hexKey(u.hex)));

    const threatenedKeys = new Set();
    for (const enemy of enemies) {
        const reachable = reachableHexes(enemy.hex, enemy.movement, occupied, obsKeys, stopKeys, costKeys);
        for (const h of reachable) {
            const k = hexKey(h);
            if (townKeys.has(k)) threatenedKeys.add(k);
        }
    }

    const priorityTowns = emptyTowns.filter(t => {
        const k = hexKey(t);
        if (ownership[k] !== 2) return true;
        return threatenedKeys.has(k);
    });

    return { townKeys, unitOnTown, emptyTowns, enemyOnTown, priorityTowns };
}

export function pickBestUnit(state, weights = DEFAULT_AI_WEIGHTS) {
    const w = { ...DEFAULT_AI_WEIGHTS, ...weights };
    const units = state.units.filter(u => u.player === 2 && u.currentWounds > 0 && !u.hasMoved && !u.hasAttacked);
    if (units.length === 0) return null;

    const losKeys = buildLosKeys(state);
    const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
    const hillKeys = new Set((state.hills || []).map(hexKey));
    const { enemyOnTown, priorityTowns } = townContext(state);
    const enemyOnTownKeys = new Set(enemyOnTown.map(u => hexKey(u.hex)));

    const { obsKeys, stopKeys, costKeys } = buildTerrainKeys(state);
    const aliveUnits = state.units.filter(u => u.currentWounds > 0);
    const occupied = new Set(aliveUnits.map(u => hexKey(u.hex)));
    const priorityTownKeys = new Set(priorityTowns.map(t => hexKey(t)));

    let best = null;
    let bestScore = -Infinity;

    for (const unit of units) {
        let score = 0;
        const rangeBonus = hillKeys.has(hexKey(unit.hex)) ? 1 : 0;
        const targets = findValidTargets(unit, enemies, losKeys, rangeBonus);

        // Can attack an enemy sitting on a town — highest priority
        const canHitTownEnemy = targets.some(t => enemyOnTownKeys.has(hexKey(t.hex)));
        if (canHitTownEnemy) score += w.hitTownEnemy;
        else if (targets.length > 0) score += w.hasTargets;

        // Can actually reach a priority town this turn — strong bonus
        if (priorityTowns.length > 0) {
            const reachable = reachableHexes(unit.hex, unit.movement, occupied, obsKeys, stopKeys, costKeys);
            const canCapture = reachable.some(h => priorityTownKeys.has(hexKey(h)));
            if (canCapture) {
                score += w.captureTown;
            } else {
                const distToTown = Math.min(...priorityTowns.map(t => pathDistance(unit.hex, t, obsKeys, costKeys)));
                if (distToTown < Infinity) score += w.towardTown / (1 + distToTown);
            }
        } else if (enemies.length > 0) {
            // No priority towns — prefer units close to enemies
            const distToEnemy = Math.min(...enemies.map(e => hexDistance(unit.hex, e.hex)));
            score += w.towardEnemy / (1 + distToEnemy);
        }

        if (score > bestScore) {
            bestScore = score;
            best = unit;
        }
    }

    return best;
}

export function pickMoveTarget(unit, state) {
    const occupied = new Set(state.units.filter(u => u.currentWounds > 0 && u.id !== unit.id).map(u => hexKey(u.hex)));
    const { obsKeys, stopKeys, costKeys } = buildTerrainKeys(state);
    const swampKeys = new Set((state.swamps || []).map(hexKey));
    let reachable = reachableHexes(unit.hex, unit.movement, occupied, obsKeys, stopKeys, costKeys);
    if (unit.currentWounds <= 1) {
        reachable = reachable.filter(h => !swampKeys.has(hexKey(h)));
    }
    if (reachable.length === 0) return null;

    const { townKeys, priorityTowns, enemyOnTown } = townContext(state);

    // Decide whether to leave a town
    const unitTownKey = hexKey(unit.hex);
    if (townKeys.has(unitTownKey)) {
        const ownership = state.townOwnership || {};
        const isPriority = priorityTowns.some(t => hexKey(t) === unitTownKey);
        // On a priority town (unowned/threatened) — stay to defend
        if (isPriority) return null;
        // On a town we hold — leave only if there are priority towns to capture or nearby enemies
        if (ownership[unitTownKey] === 2) {
            if (priorityTowns.length > 0) {
                // There's a priority town to go capture — leave this one
            } else {
                // No priority towns — leave to engage enemies if they exist
                const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
                if (enemies.length === 0) return null;
            }
        } else {
            // Town not yet owned by us — free to leave
        }
    }

    // 1. Can reach a priority town directly — take it
    const reachableTown = reachable.find(h => townKeys.has(hexKey(h)) && priorityTowns.some(t => hexKey(t) === hexKey(h)));
    if (reachableTown) return reachableTown;

    // 2. Move toward closest priority town (using real path distance)
    if (priorityTowns.length > 0) {
        const townPathDist = (hex) => Math.min(...priorityTowns.map(t => pathDistance(hex, t, obsKeys, costKeys)));
        reachable.sort((a, b) => townPathDist(a) - townPathDist(b));
        const bestDist = townPathDist(reachable[0]);
        const currentDist = townPathDist(unit.hex);
        if (bestDist < currentDist && bestDist < Infinity) return reachable[0];
    }

    // 3. Firing position: best expected damage, exposure as tie-break (safety first at 1 HP)
    const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
    if (enemies.length === 0) return null;
    const candidates = [unit.hex, ...reachable].map(h => ({
        hex: h,
        offense: attackScoreFrom(unit, h, state),
        threat: threatAt(unit, h, state),
    }));
    const fragile = unit.currentWounds <= 1;
    const shooting = candidates.filter(c => c.offense > 0);
    if (shooting.length > 0) {
        shooting.sort((a, b) => fragile
            ? (a.threat - b.threat) || (b.offense - a.offense)
            : (b.offense - a.offense) || (a.threat - b.threat));
        const best = shooting[0];
        return hexKey(best.hex) === hexKey(unit.hex) ? null : best.hex;
    }

    // 4. No shot possible: fragile threatened units flee
    const distToEnemies = h => Math.min(...enemies.map(e => hexDistance(h, e.hex)));
    if (fragile && candidates[0].threat > 0) {
        candidates.sort((a, b) => (a.threat - b.threat) || (distToEnemies(b.hex) - distToEnemies(a.hex)));
        const best = candidates[0];
        return hexKey(best.hex) === hexKey(unit.hex) ? null : best.hex;
    }

    // 5. Advance toward enemies on towns first, then any enemy, least exposed on ties
    const goals = enemyOnTown.length > 0 ? enemyOnTown.map(e => e.hex) : enemies.map(e => e.hex);
    const distToGoal = h => Math.min(...goals.map(g => hexDistance(h, g)));
    const threatByKey = new Map(candidates.map(c => [hexKey(c.hex), c.threat]));
    reachable.sort((a, b) => (distToGoal(a) - distToGoal(b)) || (threatByKey.get(hexKey(a)) - threatByKey.get(hexKey(b))));
    return reachable[0];
}

export function pickTarget(unit, state) {
    const losKeys = buildLosKeys(state);
    const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
    const hillKeys = new Set((state.hills || []).map(hexKey));
    const rangeBonus = hillKeys.has(hexKey(unit.hex)) ? 1 : 0;
    const targets = findValidTargets(unit, enemies, losKeys, rangeBonus);
    if (targets.length === 0) return null;

    const { townKeys } = townContext(state);

    // Priority: enemies on towns, then expected kills, then best expected damage
    const scored = targets.map(t => {
        const option = bestAttackOption(unit, t, state);
        return {
            target: t,
            onTown: townKeys.has(hexKey(t.hex)) ? 1 : 0,
            canKill: option && option.expected >= t.currentWounds ? 1 : 0,
            capped: option ? option.capped : 0,
        };
    });
    scored.sort((a, b) => {
        if (a.onTown !== b.onTown) return b.onTown - a.onTown;
        if (a.canKill !== b.canKill) return b.canKill - a.canKill;
        if (a.capped !== b.capped) return b.capped - a.capped;
        return a.target.currentWounds - b.target.currentWounds;
    });
    return scored[0].target;
}

function targetTerrainMods(state, targetHex) {
    const k = hexKey(targetHex);
    const townKeys = new Set((state.towns || []).map(hexKey));
    const forestKeys = new Set((state.forests || []).map(hexKey));
    const riverKeys = new Set((state.rivers || []).map(hexKey));
    return {
        coverBonus: (townKeys.has(k) || forestKeys.has(k)) ? 1 : 0,
        penalty: riverKeys.has(k) ? 1 : 0,
    };
}

function bestAttackOption(attacker, target, state) {
    const dist = hexDistance(attacker.hex, target.hex);
    const hillKeys = new Set((state.hills || []).map(hexKey));
    const onHill = hillKeys.has(hexKey(attacker.hex));
    const usable = attacker.weapons.filter(w => {
        const bonus = (w.type === "ranged" && onHill) ? 1 : 0;
        return dist >= (w.minRange || 1) && dist <= w.range + bonus;
    });
    if (usable.length === 0) return null;

    const mods = targetTerrainMods(state, target.hex);
    let best = null;
    for (const w of usable) {
        const expected = expectedDamage(attacker, w, target, mods);
        const capped = Math.min(expected, target.currentWounds);
        if (!best || capped > best.capped) best = { weapon: w, expected, capped };
    }
    return best;
}

function pickWeapon(attacker, target, state) {
    const option = bestAttackOption(attacker, target, state);
    return option ? option.weapon : null;
}

function attackScoreFrom(unit, hex, state) {
    const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
    const losKeys = buildLosKeys(state);
    const onHill = new Set((state.hills || []).map(hexKey)).has(hexKey(hex));
    let best = 0;
    for (const e of enemies) {
        const dist = hexDistance(hex, e.hex);
        if (!hasLineOfSight(hex, e.hex, losKeys)) continue;
        const mods = targetTerrainMods(state, e.hex);
        for (const w of unit.weapons) {
            const bonus = (w.type === "ranged" && onHill) ? 1 : 0;
            if (dist < (w.minRange || 1) || dist > w.range + bonus) continue;
            const capped = Math.min(expectedDamage(unit, w, e, mods), e.currentWounds);
            if (capped > best) best = capped;
        }
    }
    return best;
}

function threatAt(unit, hex, state) {
    // Estimate: an enemy threatens hex if it can be in weapon range after moving (terrain ignored)
    const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
    const mods = targetTerrainMods(state, hex);
    let total = 0;
    for (const e of enemies) {
        const dist = hexDistance(e.hex, hex);
        let best = 0;
        for (const w of e.weapons) {
            if (dist > e.movement + w.range) continue;
            const dmg = expectedDamage(e, w, unit, mods);
            if (dmg > best) best = dmg;
        }
        total += best;
    }
    return total;
}

export function shouldConsolidate(unit, hex, state) {
    const k = hexKey(hex);
    const swampKeys = new Set((state.swamps || []).map(hexKey));
    if (swampKeys.has(k)) return false;
    const townKeys = new Set((state.towns || []).map(hexKey));
    if (townKeys.has(k)) return true;
    return threatAt(unit, hex, state) < threatAt(unit, unit.hex, state);
}

export function buildAIPreview(state, action) {
    if (!action || action.type === "endTurn" || action.type === "cancel") return null;
    if (action.type === "weapon") return { type: "weapon", weapon: action.weapon };
    if (action.type === "click") {
        if (!state.selectedUnit) return { type: "select", hex: action.hex };
        const sel = state.units.find(u => u.id === state.selectedUnit.id);
        if (sel && !sel.hasMoved && state.phase === "move") return { type: "move", hex: action.hex };
        return { type: "attack", hex: action.hex };
    }
    return null;
}

export function computeAIAction(state, weights = DEFAULT_AI_WEIGHTS) {
    if (state.phase === "consolidate" && state.pendingConsolidation) {
        const unit = state.units.find(u => u.id === state.pendingConsolidation.unitId);
        return { type: "consolidate", accept: shouldConsolidate(unit, state.pendingConsolidation.hex, state) };
    }

    if (state.phase === "weapon_select" && state.pendingAttack) {
        const weapon = pickWeapon(state.pendingAttack.attacker, state.pendingAttack.target, state);
        if (weapon) return { type: "weapon", weapon };
        return { type: "cancel" };
    }

    if (state.phase === "select" || state.phase === "move" || state.phase === "attack") {
        if (!state.selectedUnit) {
            const unit = pickBestUnit(state, weights);
            if (!unit) return { type: "endTurn" };
            return { type: "click", hex: unit.hex };
        }

        const sel = state.units.find(u => u.id === state.selectedUnit.id);

        // Move first if it captures a priority town or improves the expected attack
        if (!sel.hasMoved) {
            const moveHex = pickMoveTarget(sel, state);
            if (moveHex) {
                const { townKeys, priorityTowns } = townContext(state);
                const movesToTown = townKeys.has(hexKey(moveHex)) && priorityTowns.some(t => hexKey(t) === hexKey(moveHex));
                if (movesToTown) return { type: "click", hex: moveHex };
                if (!sel.hasAttacked && attackScoreFrom(sel, moveHex, state) > attackScoreFrom(sel, sel.hex, state)) {
                    return { type: "click", hex: moveHex };
                }
            }
            if (!sel.hasAttacked) {
                const target = pickTarget(sel, state);
                if (target) return { type: "click", hex: target.hex };
            }
            if (moveHex) return { type: "click", hex: moveHex };
            return { type: "endTurn" };
        }

        if (!sel.hasAttacked) {
            const target = pickTarget(sel, state);
            if (target) return { type: "click", hex: target.hex };
        }

        return { type: "endTurn" };
    }

    return null;
}
