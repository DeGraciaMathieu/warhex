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

function pickBestUnit(state) {
    const units = state.units.filter(u => u.player === 2 && u.currentWounds > 0 && !u.hasMoved && !u.hasAttacked);
    if (units.length === 0) return null;
    const losKeys = buildLosKeys(state);
    const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
    const hillKeys = new Set((state.hills || []).map(hexKey));
    for (const unit of units) {
        const rangeBonus = hillKeys.has(hexKey(unit.hex)) ? 1 : 0;
        if (findValidTargets(unit, enemies, losKeys, rangeBonus).length > 0) return unit;
    }
    return units[0];
}

function pickMoveTarget(unit, state) {
    const occupied = new Set(state.units.filter(u => u.currentWounds > 0 && u.id !== unit.id).map(u => hexKey(u.hex)));
    const { obsKeys, stopKeys, forestKeys } = buildTerrainKeys(state);
    const reachable = reachableHexes(unit.hex, unit.movement, occupied, obsKeys, stopKeys, forestKeys);
    if (reachable.length === 0) return null;
    const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
    if (enemies.length === 0) return reachable[0];
    const closest = enemies.reduce((best, e) => {
        const d = hexDistance(unit.hex, e.hex);
        return d < best.dist ? { enemy: e, dist: d } : best;
    }, { enemy: null, dist: Infinity });
    reachable.sort((a, b) => hexDistance(a, closest.enemy.hex) - hexDistance(b, closest.enemy.hex));
    return reachable[0];
}

function pickTarget(unit, state) {
    const losKeys = buildLosKeys(state);
    const enemies = state.units.filter(u => u.player === 1 && u.currentWounds > 0);
    const hillKeys = new Set((state.hills || []).map(hexKey));
    const rangeBonus = hillKeys.has(hexKey(unit.hex)) ? 1 : 0;
    const targets = findValidTargets(unit, enemies, losKeys, rangeBonus);
    if (targets.length === 0) return null;
    targets.sort((a, b) => a.currentWounds - b.currentWounds);
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
