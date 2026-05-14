import { hexDistance, hexKey, reachableHexes, hasLineOfSight, hexesInRange } from "./hex.js";
import { resolveAttack } from "./combat.js";
import { computeTownControl, checkWinner, ACTIVATIONS_PER_TURN } from "./units.js";

export function getUnitTerrainEffects(unit, state) {
    const k = hexKey(unit.hex);
    const townKeys = new Set((state.towns || []).map(hexKey));
    const forestKeys = new Set((state.forests || []).map(hexKey));
    const riverKeys = new Set((state.rivers || []).map(hexKey));
    const hillKeys = new Set((state.hills || []).map(hexKey));
    const effects = [];
    if (townKeys.has(k) || forestKeys.has(k)) effects.push("cover");
    if (riverKeys.has(k)) effects.push("river");
    if (hillKeys.has(k)) effects.push("hill");
    return effects;
}

export function getCombatModifiers(attacker, target, state) {
    const k = hexKey;
    const townKeys = new Set((state.towns || []).map(k));
    const forestKeys = new Set((state.forests || []).map(k));
    const riverKeys = new Set((state.rivers || []).map(k));
    const hillKeys = new Set((state.hills || []).map(k));
    const ak = k(attacker.hex);
    const tk = k(target.hex);
    const attackerMods = [];
    const targetMods = [];
    if (hillKeys.has(ak)) attackerMods.push({ type: "bonus", label: "Colline (portée +1)", icon: "⛰" });
    if (townKeys.has(tk)) targetMods.push({ type: "malus", label: "Couvert de ville (svg -1)", icon: "🏰" });
    if (forestKeys.has(tk)) targetMods.push({ type: "malus", label: "Couvert de forêt (svg -1)", icon: "🌲" });
    if (riverKeys.has(tk)) targetMods.push({ type: "bonus", label: "Rivière (svg +1)", icon: "🏞" });
    return { attacker: attackerMods, target: targetMods };
}

function buildLosKeys(state) {
    return new Set([...state.obstacles, ...(state.towns || []), ...(state.forests || []), ...(state.hills || [])].map(hexKey));
}

function buildTerrainKeys(state) {
    const obsKeys = new Set(state.obstacles.map(hexKey));
    const stopKeys = new Set([...(state.rivers || []), ...(state.towns || []), ...(state.swamps || [])].map(hexKey));
    const costKeys = new Set([...(state.forests || []), ...(state.hills || [])].map(hexKey));
    return { obsKeys, stopKeys, costKeys };
}

function findValidTargets(unit, enemies, losKeys, rangeBonus = 0) {
    return enemies.filter(e => {
        const dist = hexDistance(unit.hex, e.hex);
        if (!hasLineOfSight(unit.hex, e.hex, losKeys)) return false;
        return unit.weapons.some(w => {
            const bonus = (w.type === "ranged" ? rangeBonus : 0);
            return dist >= (w.minRange || 1) && dist <= w.range + bonus;
        });
    });
}

function computeAttackRange(unit, sources, losKeys, hillKeys) {
    const maxRange = Math.max(...unit.weapons.map(w => w.range));
    const seen = new Set();
    const result = [];
    for (const src of sources) {
        const rangeBonus = hillKeys.has(hexKey(src)) ? 1 : 0;
        const effectiveRange = maxRange + rangeBonus;
        for (const hex of hexesInRange(src, effectiveRange)) {
            const k = hexKey(hex);
            if (seen.has(k)) continue;
            const dist = hexDistance(src, hex);
            const inRange = unit.weapons.some(w => {
                const bonus = (w.type === "ranged" && hillKeys.has(hexKey(src))) ? 1 : 0;
                return dist >= (w.minRange || 1) && dist <= w.range + bonus;
            });
            if (inRange && hasLineOfSight(src, hex, losKeys)) {
                seen.add(k);
                result.push(hex);
            }
        }
    }
    return result;
}

function finishActivation(s, unitId, units) {
    const used = s.activationsUsed + 1;
    const activated = [...s.activatedUnitIds, unitId];
    const remaining = units.filter(u =>
        u.player === s.currentPlayer && u.currentWounds > 0 && !activated.includes(u.id)
    );
    return {
        activationsUsed: used,
        activatedUnitIds: activated,
        activeUnitId: null,
        selectedUnit: null,
        phase: "select",
        validMoves: [],
        validTargets: [],
        attackRangeHexes: [],
        pendingAttack: null,
        autoEndTurn: used >= ACTIVATIONS_PER_TURN || remaining.length === 0,
    };
}

export function computeDeselect(s) {
    const sel = s.units.find(u => u.id === s.selectedUnit?.id);
    const hasActed = sel && (sel.hasMoved || sel.hasAttacked);
    if (hasActed) {
        return { ...s, ...finishActivation(s, sel.id, s.units) };
    }
    return { ...s, selectedUnit: null, activeUnitId: null, phase: "select", validMoves: [], validTargets: [], attackRangeHexes: [] };
}

export function handleClick(s, hex) {
    if (s.winner || s.phase === "weapon_select" || s.phase === "resolving" || s.autoEndTurn) return s;
    const k = hexKey(hex);
    const unitOnHex = s.units.find(u => u.currentWounds > 0 && hexKey(u.hex) === k);
    const moveKeys = new Set(s.validMoves.map(hexKey));
    const targetKeys = new Set((s.validTargets || []).map(u => hexKey(u.hex)));

    if ((s.phase === "select" || s.phase === "attack") && targetKeys.has(k)) {
        const target = s.validTargets.find(u => hexKey(u.hex) === k);
        return { ...s, phase: "weapon_select", pendingAttack: { attacker: s.selectedUnit, target } };
    }

    if ((s.phase === "select" || s.phase === "move") && moveKeys.has(k)) {
        const movedUnit = { ...s.selectedUnit, hex, hasMoved: true };
        const swampKeys = new Set((s.swamps || []).map(hexKey));
        const hillKeys = new Set((s.hills || []).map(hexKey));
        const townKeys = new Set((s.towns || []).map(hexKey));
        const poisoned = swampKeys.has(k)
            ? { ...movedUnit, currentWounds: Math.max(0, movedUnit.currentWounds - 1) }
            : movedUnit;
        const units = s.units.map(u => u.id === poisoned.id ? poisoned : u);
        const townOwnership = townKeys.has(k)
            ? { ...s.townOwnership, [k]: s.currentPlayer }
            : s.townOwnership;
        if (poisoned.currentWounds <= 0) {
            const dyingUnits = [...(s.dyingUnits || []), { hex: poisoned.hex, symbol: poisoned.symbol, player: poisoned.player, deathTime: Date.now() }];
            return { ...s, units, townOwnership, dyingUnits, ...finishActivation(s, poisoned.id, units) };
        }
        const losKeys = buildLosKeys(s);
        const enemies = units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
        const rangeBonus = hillKeys.has(hexKey(poisoned.hex)) ? 1 : 0;
        const validTargets = poisoned.hasAttacked ? [] : findValidTargets(poisoned, enemies, losKeys, rangeBonus);
        if (validTargets.length === 0) {
            return { ...s, units, townOwnership, ...finishActivation(s, poisoned.id, units) };
        }
        return { ...s, units, townOwnership, selectedUnit: poisoned, activeUnitId: poisoned.id, phase: "select", validMoves: [], validTargets, attackRangeHexes: [], autoEndTurn: false };
    }

    if (unitOnHex && unitOnHex.player === s.currentPlayer) {
        if (s.activeUnitId && unitOnHex.id !== s.activeUnitId) return s;
        if (s.activatedUnitIds.includes(unitOnHex.id)) return s;
        const cur = s.units.find(u => u.id === unitOnHex.id);
        const occupied = new Set(s.units.filter(u => u.currentWounds > 0 && u.id !== cur.id).map(u => hexKey(u.hex)));
        const { obsKeys, stopKeys, costKeys } = buildTerrainKeys(s);
        const validMoves = cur.hasMoved ? [] : reachableHexes(cur.hex, cur.movement, occupied, obsKeys, stopKeys, costKeys);
        const enemies = s.units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
        const losKeys = buildLosKeys(s);
        const hillKeys = new Set((s.hills || []).map(hexKey));
        const rangeBonus = hillKeys.has(hexKey(cur.hex)) ? 1 : 0;
        const validTargets = cur.hasAttacked ? [] : findValidTargets(cur, enemies, losKeys, rangeBonus);
        const attackRangeSources = [cur.hex, ...validMoves];
        const attackRangeHexes = cur.hasAttacked ? [] : computeAttackRange(cur, attackRangeSources, losKeys, hillKeys);
        return { ...s, selectedUnit: cur, phase: "select", validMoves, validTargets, attackRangeHexes };
    }

    if (s.selectedUnit) {
        return computeDeselect(s);
    }

    return s;
}

export function computeMove(s) {
    const cur = s.units.find(u => u.id === s.selectedUnit?.id);
    if (!cur || cur.hasMoved) return s;
    const occupied = new Set(s.units.filter(u => u.currentWounds > 0 && u.id !== cur.id).map(u => hexKey(u.hex)));
    const { obsKeys, stopKeys, costKeys } = buildTerrainKeys(s);
    return { ...s, phase: "move", validMoves: reachableHexes(cur.hex, cur.movement, occupied, obsKeys, stopKeys, costKeys), validTargets: [] };
}

export function computeAttack(s) {
    const cur = s.units.find(u => u.id === s.selectedUnit?.id);
    if (!cur || cur.hasAttacked) return s;
    const enemies = s.units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
    const losKeys = buildLosKeys(s);
    const hillKeys = new Set((s.hills || []).map(hexKey));
    const rangeBonus = hillKeys.has(hexKey(cur.hex)) ? 1 : 0;
    const validTargets = findValidTargets(cur, enemies, losKeys, rangeBonus);
    return { ...s, phase: "attack", validTargets, validMoves: [], attackRangeHexes: [], selectedUnit: cur };
}

export function computeWeaponSelect(s, weapon) {
    if (!s.pendingAttack) return null;
    const { attacker, target } = s.pendingAttack;
    const dist = hexDistance(attacker.hex, target.hex);
    const hillKeys = new Set((s.hills || []).map(hexKey));
    const rangeBonus = (weapon.type === "ranged" && hillKeys.has(hexKey(attacker.hex))) ? 1 : 0;
    if (dist < (weapon.minRange || 1) || dist > weapon.range + rangeBonus) {
        return { state: { ...s, phase: "select", pendingAttack: null, validTargets: [], validMoves: [], attackRangeHexes: [] }, anim: null };
    }

    const townKeys = new Set((s.towns || []).map(hexKey));
    const forestKeys = new Set((s.forests || []).map(hexKey));
    const riverKeys = new Set((s.rivers || []).map(hexKey));
    const targetKey = hexKey(target.hex);
    const coverBonus = (townKeys.has(targetKey) || forestKeys.has(targetKey)) ? 1 : 0;
    const penalty = riverKeys.has(targetKey) ? 1 : 0;
    const { damage, log } = resolveAttack(attacker, weapon, target, { coverBonus, penalty });
    const isDead = Math.max(0, target.currentWounds - damage) <= 0;

    return {
        state: { ...s, phase: "resolving", activeUnitId: attacker.id },
        anim: { log, phase: 0, dice: 0, done: false, attacker, target, weaponName: weapon.name, damage, isDead },
    };
}

export function applyDamage(s, anim) {
    const { attacker, target, damage } = anim;
    const newWounds = Math.max(0, target.currentWounds - damage);
    const isDead = newWounds <= 0;
    const units = s.units.map(u => {
        if (u.id === attacker.id) return { ...u, hasAttacked: true };
        if (u.id === target.id) return { ...u, currentWounds: newWounds };
        return u;
    });
    const dyingUnits = isDead
        ? [...(s.dyingUnits || []), { hex: target.hex, symbol: target.symbol, player: target.player, deathTime: Date.now() }]
        : (s.dyingUnits || []);
    const kills = isDead ? { ...s.kills, [attacker.player]: (s.kills?.[attacker.player] || 0) + 1 } : s.kills;
    const hitEffects = damage > 0
        ? [...(s.hitEffects || []), { hex: target.hex, damage, time: Date.now() }]
        : (s.hitEffects || []);
    return {
        ...s, units, dyingUnits, kills, hitEffects, ...finishActivation(s, attacker.id, units),
    };
}

export function computeEndTurn(s) {
    if (s.winner) return s;
    const nextPlayer = s.currentPlayer === 1 ? 2 : 1;
    const endOfRound = nextPlayer === 1;
    const scores = { ...s.scores };
    if (endOfRound) {
        const control = computeTownControl(s.townOwnership || {});
        scores[1] += control[1];
        scores[2] += control[2];
    }
    const scoreHistory = endOfRound ? [...s.scoreHistory, { round: s.round, scores: { 1: scores[1], 2: scores[2] } }] : s.scoreHistory;
    const winner = endOfRound ? checkWinner(scores, s.round) : null;
    const newRound = endOfRound && !winner ? s.round + 1 : s.round;
    return {
        ...s, scores, scoreHistory,
        units: s.units.map(u => ({ ...u, hasMoved: false, hasAttacked: false })),
        currentPlayer: nextPlayer, activeUnitId: null, activationsUsed: 0, activatedUnitIds: [],
        phase: "select", selectedUnit: null, validMoves: [], validTargets: [], attackRangeHexes: [], pendingAttack: null,
        round: newRound, winner,
        autoEndTurn: false,
    };
}
