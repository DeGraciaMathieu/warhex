import { hexDistance, hexKey, reachableHexes, hasLineOfSight } from "./hex.js";

function buildLosKeys(state) {
    return new Set([...state.obstacles, ...(state.towns || []), ...(state.forests || [])].map(hexKey));
}

function buildTerrainKeys(state) {
    const obsKeys = new Set(state.obstacles.map(hexKey));
    const stopKeys = new Set([...(state.rivers || []), ...(state.towns || []), ...(state.swamps || [])].map(hexKey));
    const forestKeys = new Set((state.forests || []).map(hexKey));
    return { obsKeys, stopKeys, forestKeys };
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
    const { obsKeys, stopKeys, forestKeys } = buildTerrainKeys(state);
    const enemies = aliveUnits.filter(u => u.player === 1);
    const occupied = new Set(aliveUnits.map(u => hexKey(u.hex)));

    const threatenedKeys = new Set();
    for (const enemy of enemies) {
        const reachable = reachableHexes(enemy.hex, enemy.movement, occupied, obsKeys, stopKeys, forestKeys);
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

        // Close to a priority town (not owned or owned but threatened)
        if (priorityTowns.length > 0) {
            const distToTown = Math.min(...priorityTowns.map(t => hexDistance(unit.hex, t)));
            score += 20 / (1 + distToTown);
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
    const { obsKeys, stopKeys, forestKeys } = buildTerrainKeys(state);
    const reachable = reachableHexes(unit.hex, unit.movement, occupied, obsKeys, stopKeys, forestKeys);
    if (reachable.length === 0) return null;

    const { townKeys, priorityTowns, enemyOnTown } = townContext(state);

    // Stay on town unless first activation and an ally can replace us
    if (townKeys.has(hexKey(unit.hex))) {
        if (state.activationsUsed > 0) return null;
        const allies = state.units.filter(u => u.player === 2 && u.currentWounds > 0 && u.id !== unit.id && !u.hasMoved);
        const canReplace = allies.some(ally => {
            const allyOccupied = new Set(state.units.filter(u => u.currentWounds > 0 && u.id !== ally.id && u.id !== unit.id).map(u => hexKey(u.hex)));
            const allyReachable = reachableHexes(ally.hex, ally.movement, allyOccupied, obsKeys, stopKeys, forestKeys);
            return allyReachable.some(h => hexKey(h) === hexKey(unit.hex));
        });
        if (!canReplace) return null;
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
