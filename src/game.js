import { hexDistance, hexKey, reachableHexes, hasLineOfSight } from "./hex.js";
import { resolveAttack } from "./combat.js";
import { computeTownControl, checkWinner } from "./units.js";

function buildLosKeys(state) {
    return new Set([...state.obstacles, ...(state.towns || [])].map(hexKey));
}

function buildTerrainKeys(state) {
    const obsKeys = new Set(state.obstacles.map(hexKey));
    const stopKeys = new Set([...(state.rivers || []), ...(state.towns || [])].map(hexKey));
    const forestKeys = new Set((state.forests || []).map(hexKey));
    return { obsKeys, stopKeys, forestKeys };
}

function findValidTargets(unit, enemies, losKeys) {
    const maxRange = Math.max(...unit.weapons.map(w => w.range));
    return enemies.filter(e => hexDistance(unit.hex, e.hex) <= maxRange && hasLineOfSight(unit.hex, e.hex, losKeys));
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
        const units = s.units.map(u => u.id === movedUnit.id ? movedUnit : u);
        const losKeys = buildLosKeys(s);
        const enemies = units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
        const validTargets = movedUnit.hasAttacked ? [] : findValidTargets(movedUnit, enemies, losKeys);
        const autoEnd = validTargets.length === 0;
        return { ...s, units, selectedUnit: movedUnit, activeUnitId: movedUnit.id, phase: "select", validMoves: [], validTargets, autoEndTurn: autoEnd };
    }

    if (unitOnHex && unitOnHex.player === s.currentPlayer) {
        if (s.activeUnitId && unitOnHex.id !== s.activeUnitId) return s;
        const cur = s.units.find(u => u.id === unitOnHex.id);
        const occupied = new Set(s.units.filter(u => u.currentWounds > 0 && u.id !== cur.id).map(u => hexKey(u.hex)));
        const { obsKeys, stopKeys, forestKeys } = buildTerrainKeys(s);
        const validMoves = cur.hasMoved ? [] : reachableHexes(cur.hex, cur.movement, occupied, obsKeys, stopKeys, forestKeys);
        const enemies = s.units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
        const losKeys = buildLosKeys(s);
        const validTargets = cur.hasAttacked ? [] : findValidTargets(cur, enemies, losKeys);
        return { ...s, selectedUnit: cur, phase: "select", validMoves, validTargets };
    }

    return s;
}

export function computeMove(s) {
    const cur = s.units.find(u => u.id === s.selectedUnit?.id);
    if (!cur || cur.hasMoved) return s;
    const occupied = new Set(s.units.filter(u => u.currentWounds > 0 && u.id !== cur.id).map(u => hexKey(u.hex)));
    const { obsKeys, stopKeys, forestKeys } = buildTerrainKeys(s);
    return { ...s, phase: "move", validMoves: reachableHexes(cur.hex, cur.movement, occupied, obsKeys, stopKeys, forestKeys), validTargets: [] };
}

export function computeAttack(s) {
    const cur = s.units.find(u => u.id === s.selectedUnit?.id);
    if (!cur || cur.hasAttacked) return s;
    const enemies = s.units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
    const losKeys = buildLosKeys(s);
    const validTargets = findValidTargets(cur, enemies, losKeys);
    return { ...s, phase: "attack", validTargets, validMoves: [], selectedUnit: cur };
}

export function computeWeaponSelect(s, weapon) {
    if (!s.pendingAttack) return null;
    const { attacker, target } = s.pendingAttack;
    const dist = hexDistance(attacker.hex, target.hex);
    if (dist > weapon.range) {
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
    const units = s.units.map(u => {
        if (u.id === attacker.id) return { ...u, hasAttacked: true };
        if (u.id === target.id) return { ...u, currentWounds: newWounds };
        return u;
    });
    return {
        ...s, units, phase: "select", selectedUnit: null, validMoves: [], validTargets: [],
        pendingAttack: null, autoEndTurn: true,
        roundLog: { weapon: anim.weaponName, attacker: attacker.name, target: target.name, log: anim.log, isDead: anim.isDead, damage },
    };
}

export function computeEndTurn(s) {
    if (s.winner) return s;
    const nextPlayer = s.currentPlayer === 1 ? 2 : 1;
    const endOfRound = nextPlayer === 1;
    const scores = { ...s.scores };
    if (endOfRound) {
        const control = computeTownControl(s.units, s.towns);
        scores[1] += control[1];
        scores[2] += control[2];
    }
    const winner = endOfRound ? checkWinner(scores, s.round) : null;
    const newRound = endOfRound && !winner ? s.round + 1 : s.round;
    return {
        ...s, scores,
        units: s.units.map(u => ({ ...u, hasMoved: false, hasAttacked: false })),
        currentPlayer: nextPlayer, activeUnitId: null,
        phase: "select", selectedUnit: null, validMoves: [], validTargets: [], pendingAttack: null,
        round: newRound, winner,
        autoEndTurn: false,
    };
}
