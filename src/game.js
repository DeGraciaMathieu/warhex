import { hexDistance, hexKey, reachableHexes, hasLineOfSight } from "./hex.js";
import { resolveAttack } from "./combat.js";
import { computeTownControl, checkWinner, ACTIVATIONS_PER_TURN } from "./units.js";

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
    return { ...s, selectedUnit: null, activeUnitId: null, phase: "select", validMoves: [], validTargets: [] };
}

export function handleClick(s, hex) {
    if (s.winner || s.phase === "weapon_select" || s.phase === "resolving") return s;
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
        return { ...s, units, townOwnership, selectedUnit: poisoned, activeUnitId: poisoned.id, phase: "select", validMoves: [], validTargets, autoEndTurn: false };
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
        return { ...s, selectedUnit: cur, phase: "select", validMoves, validTargets };
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
    return { ...s, phase: "attack", validTargets, validMoves: [], selectedUnit: cur };
}

export function computeWeaponSelect(s, weapon) {
    if (!s.pendingAttack) return null;
    const { attacker, target } = s.pendingAttack;
    const dist = hexDistance(attacker.hex, target.hex);
    const hillKeys = new Set((s.hills || []).map(hexKey));
    const rangeBonus = (weapon.type === "ranged" && hillKeys.has(hexKey(attacker.hex))) ? 1 : 0;
    if (dist > weapon.range + rangeBonus) {
        return { state: { ...s, phase: "select", pendingAttack: null, validTargets: [], validMoves: [] }, anim: null };
    }

    const townKeys = new Set((s.towns || []).map(hexKey));
    const coverBonus = townKeys.has(hexKey(target.hex)) ? 1 : 0;
    const { damage, log } = resolveAttack(attacker, weapon, target, { coverBonus });
    const isDead = Math.max(0, target.currentWounds - damage) <= 0;

    return {
        state: { ...s, phase: "resolving", activeUnitId: attacker.id, roundLog: null },
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
    return {
        ...s, units, dyingUnits, ...finishActivation(s, attacker.id, units),
        roundLog: { weapon: anim.weaponName, attacker: attacker.name, target: target.name, log: anim.log, isDead: anim.isDead, damage },
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
    const winner = endOfRound ? checkWinner(scores, s.round) : null;
    const newRound = endOfRound && !winner ? s.round + 1 : s.round;
    return {
        ...s, scores,
        units: s.units.map(u => ({ ...u, hasMoved: false, hasAttacked: false })),
        currentPlayer: nextPlayer, activeUnitId: null, activationsUsed: 0, activatedUnitIds: [],
        phase: "select", selectedUnit: null, validMoves: [], validTargets: [], pendingAttack: null,
        round: newRound, winner,
        autoEndTurn: false,
    };
}
