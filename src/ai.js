import { hexDistance, hexKey, reachableHexes, hasLineOfSight } from "./hex.js";

function buildLosKeys(state) {
    return new Set([...state.obstacles, ...(state.towns || []), ...(state.forests || [])].map(hexKey));
}

function buildTerrainKeys(state) {
    const obsKeys = new Set(state.obstacles.map(hexKey));
    const stopKeys = new Set([...(state.rivers || []), ...(state.towns || []), ...(state.swamps || [])].map(hexKey));
    const costKeys = new Set([...(state.forests || []), ...(state.hills || [])].map(hexKey));
    return { obsKeys, stopKeys, costKeys };
}

function findValidTargets(unit, enemies, losKeys, rangeBonus = 0) {
    const maxRange = Math.max(...unit.weapons.map(w => w.range + (w.type === "ranged" ? rangeBonus : 0)));
    return enemies.filter(e => hexDistance(unit.hex, e.hex) <= maxRange && hasLineOfSight(unit.hex, e.hex, losKeys));
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

export function pickBestUnit(state) {
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
        if (canHitTownEnemy) score += 100;
        else if (targets.length > 0) score += 10;

        // Can actually reach a priority town this turn — strong bonus
        if (priorityTowns.length > 0) {
            const reachable = reachableHexes(unit.hex, unit.movement, occupied, obsKeys, stopKeys, costKeys);
            const canCapture = reachable.some(h => priorityTownKeys.has(hexKey(h)));
            if (canCapture) {
                score += 50;
            } else {
                const distToTown = Math.min(...priorityTowns.map(t => hexDistance(unit.hex, t)));
                score += 20 / (1 + distToTown);
            }
        } else if (enemies.length > 0) {
            // No priority towns — prefer units close to enemies
            const distToEnemy = Math.min(...enemies.map(e => hexDistance(unit.hex, e.hex)));
            score += 5 / (1 + distToEnemy);
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

    // 2. Move toward closest priority town
    if (priorityTowns.length > 0) {
        reachable.sort((a, b) => {
            const da = Math.min(...priorityTowns.map(t => hexDistance(a, t)));
            const db = Math.min(...priorityTowns.map(t => hexDistance(b, t)));
            return da - db;
        });
        const bestDist = Math.min(...priorityTowns.map(t => hexDistance(reachable[0], t)));
        const currentDist = Math.min(...priorityTowns.map(t => hexDistance(unit.hex, t)));
        if (bestDist < currentDist) return reachable[0];
    }

    // 3. Move toward enemy on town (to attack next turn)
    if (enemyOnTown.length > 0) {
        reachable.sort((a, b) => {
            const da = Math.min(...enemyOnTown.map(e => hexDistance(a, e.hex)));
            const db = Math.min(...enemyOnTown.map(e => hexDistance(b, e.hex)));
            return da - db;
        });
        return reachable[0];
    }

    // 4. Fallback: move toward closest enemy
    const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
    if (enemies.length === 0) return reachable[0];
    const closest = enemies.reduce((best, e) => {
        const d = hexDistance(unit.hex, e.hex);
        return d < best.dist ? { enemy: e, dist: d } : best;
    }, { enemy: null, dist: Infinity });
    reachable.sort((a, b) => hexDistance(a, closest.enemy.hex) - hexDistance(b, closest.enemy.hex));
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

    // Priority: enemies on towns first, then lowest HP
    targets.sort((a, b) => {
        const aOnTown = townKeys.has(hexKey(a.hex)) ? 1 : 0;
        const bOnTown = townKeys.has(hexKey(b.hex)) ? 1 : 0;
        if (aOnTown !== bOnTown) return bOnTown - aOnTown;
        return a.currentWounds - b.currentWounds;
    });
    return targets[0];
}

function pickWeapon(attacker, target, state) {
    const dist = hexDistance(attacker.hex, target.hex);
    const hillKeys = new Set((state.hills || []).map(hexKey));
    const onHill = hillKeys.has(hexKey(attacker.hex));
    const usable = attacker.weapons.filter(w => {
        const bonus = (w.type === "ranged" && onHill) ? 1 : 0;
        return dist <= w.range + bonus;
    });
    if (usable.length === 0) return null;
    usable.sort((a, b) => (b.attacks * b.damage) - (a.attacks * a.damage));
    return usable[0];
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

export function computeAIAction(state) {
    if (state.phase === "weapon_select" && state.pendingAttack) {
        const weapon = pickWeapon(state.pendingAttack.attacker, state.pendingAttack.target, state);
        if (weapon) return { type: "weapon", weapon };
        return { type: "cancel" };
    }

    if (state.phase === "select" || state.phase === "move" || state.phase === "attack") {
        if (!state.selectedUnit) {
            const unit = pickBestUnit(state);
            if (!unit) return { type: "endTurn" };
            return { type: "click", hex: unit.hex };
        }

        const sel = state.units.find(u => u.id === state.selectedUnit.id);

        // Move first if a priority town is reachable (capture > opportunistic attack)
        if (!sel.hasMoved) {
            const moveHex = pickMoveTarget(sel, state);
            if (moveHex) {
                const { townKeys, priorityTowns } = townContext(state);
                const movesToTown = townKeys.has(hexKey(moveHex)) && priorityTowns.some(t => hexKey(t) === hexKey(moveHex));
                if (movesToTown) return { type: "click", hex: moveHex };
            }
        }

        if (!sel.hasAttacked) {
            const target = pickTarget(sel, state);
            if (target) return { type: "click", hex: target.hex };
        }

        if (!sel.hasMoved) {
            const moveHex = pickMoveTarget(sel, state);
            if (moveHex) return { type: "click", hex: moveHex };
        }

        if (!sel.hasAttacked) {
            const target = pickTarget(sel, state);
            if (target) return { type: "click", hex: target.hex };
        }

        return { type: "endTurn" };
    }

    return null;
}
