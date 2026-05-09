import { hexKey } from "./hex.js";

const UNIT_TEMPLATES = {
    warrior: {
        name: "Warrior", symbol: "⚔",
        movement: 3, weaponSkill: 3, ballisticSkill: 4,
        toughness: 4, wounds: 2, save: 4,
        weapons: [
            { id: "rifle", name: "Rifle", type: "ranged", range: 2, attacks: 2, strength: 4, ap: -1, damage: 1 },
            { id: "sword", name: "Sword", type: "melee", range: 1, attacks: 3, strength: 4, ap: 0, damage: 1 },
        ],
    },
};

let UID = 0;

export function resetUID() { UID = 0; }

export function createUnit(type, player, hex) {
    const t = UNIT_TEMPLATES[type];
    return { ...t, id: UID++, player, hex, currentWounds: t.wounds, hasMoved: false, hasAttacked: false };
}

function randomAvailableHexes(count, reservedKeys) {
    const allHexes = [];
    for (let q = -5; q <= 5; q++) {
        for (let r = -5; r <= 5; r++) {
            const s = -q - r;
            if (Math.abs(s) <= 5) allHexes.push({ q, r, s });
        }
    }
    const available = allHexes.filter(h => !reservedKeys.has(`${h.q},${h.r},${h.s}`));
    const result = [];
    for (let i = 0; i < count && available.length > 0; i++) {
        const idx = Math.floor(Math.random() * available.length);
        result.push(available.splice(idx, 1)[0]);
    }
    return result;
}

const DIRECTIONS = [
    { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
    { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 },
];

function generateRiver(reservedKeys) {
    const key = h => `${h.q},${h.r},${h.s}`;
    const isValid = h => Math.abs(h.q) <= 5 && Math.abs(h.r) <= 5 && Math.abs(h.s) <= 5;
    const edgeHexes = [];
    for (let q = -5; q <= 5; q++) {
        const s = -q + 5;
        const h = { q, r: -5, s };
        if (isValid(h) && !reservedKeys.has(key(h))) edgeHexes.push(h);
    }
    if (edgeHexes.length === 0) return [];
    let current = edgeHexes[Math.floor(Math.random() * edgeHexes.length)];
    const river = [current];
    const visited = new Set([key(current)]);
    while (current.r < 5) {
        const forward = DIRECTIONS.filter(d => d.r >= 0);
        const candidates = forward
            .map(d => ({ q: current.q + d.q, r: current.r + d.r, s: current.s + d.s }))
            .filter(h => isValid(h) && !visited.has(key(h)) && !reservedKeys.has(key(h)));
        if (candidates.length === 0) break;
        current = candidates[Math.floor(Math.random() * candidates.length)];
        river.push(current);
        visited.add(key(current));
    }
    return river;
}

function generateForests(count, reservedKeys) {
    const key = h => `${h.q},${h.r},${h.s}`;
    const isValid = h => Math.abs(h.q) <= 5 && Math.abs(h.r) <= 5 && Math.abs(h.s) <= 5;
    const allReserved = new Set(reservedKeys);
    const forests = [];
    for (let i = 0; i < count; i++) {
        const size = 2 + Math.floor(Math.random() * 4);
        const start = randomAvailableHexes(1, allReserved);
        if (start.length === 0) break;
        const cluster = [start[0]];
        allReserved.add(key(start[0]));
        while (cluster.length < size) {
            const candidates = [];
            for (const h of cluster) {
                for (const d of DIRECTIONS) {
                    const n = { q: h.q + d.q, r: h.r + d.r, s: h.s + d.s };
                    if (isValid(n) && !allReserved.has(key(n))) candidates.push(n);
                }
            }
            if (candidates.length === 0) break;
            const picked = candidates[Math.floor(Math.random() * candidates.length)];
            cluster.push(picked);
            allReserved.add(key(picked));
        }
        // Reserve neighbors as buffer to prevent clusters from merging
        for (const h of cluster) {
            for (const d of DIRECTIONS) {
                const n = { q: h.q + d.q, r: h.r + d.r, s: h.s + d.s };
                allReserved.add(key(n));
            }
        }
        forests.push(...cluster);
    }
    return forests;
}

export function computeTownControl(units, towns) {
    const townKeys = new Set(towns.map(hexKey));
    const alive = units.filter(u => u.currentWounds > 0);
    return {
        1: alive.filter(u => u.player === 1 && townKeys.has(hexKey(u.hex))).length,
        2: alive.filter(u => u.player === 2 && townKeys.has(hexKey(u.hex))).length,
    };
}

export function checkWinner(scores, round) {
    if (round < 5) return null;
    if (scores[1] > scores[2]) return 1;
    if (scores[2] > scores[1]) return 2;
    return "draw";
}

export function initState() {
    const units = [
        createUnit("warrior", 1, { q: -4, r: 0, s: 4 }),
        createUnit("warrior", 1, { q: -3, r: 3, s: 0 }),
        createUnit("warrior", 1, { q: -4, r: 2, s: 2 }),
        createUnit("warrior", 2, { q: 4, r: 0, s: -4 }),
        createUnit("warrior", 2, { q: 3, r: -3, s: 0 }),
        createUnit("warrior", 2, { q: 4, r: -2, s: -2 }),
    ];
    const reservedKeys = new Set(units.map(u => `${u.hex.q},${u.hex.r},${u.hex.s}`));
    const obstacles = randomAvailableHexes(9, reservedKeys);
    const obstacleKeys = new Set(obstacles.map(o => `${o.q},${o.r},${o.s}`));
    const allReserved = new Set([...reservedKeys, ...obstacleKeys]);
    const rivers = generateRiver(allReserved);
    const riverKeys = new Set(rivers.map(r => `${r.q},${r.r},${r.s}`));
    const allReserved2 = new Set([...allReserved, ...riverKeys]);
    const towns = randomAvailableHexes(4, allReserved2);
    const townKeys = new Set(towns.map(t => `${t.q},${t.r},${t.s}`));
    const allReserved3 = new Set([...allReserved2, ...townKeys]);
    const forests = generateForests(3, allReserved3);
    return {
        units,
        obstacles,
        rivers,
        towns,
        forests,
        currentPlayer: 1,
        phase: "select",
        selectedUnit: null,
        validMoves: [],
        validTargets: [],
        pendingAttack: null,
        combatLog: [],
        roundLog: null,
        winner: null,
        round: 1,
        scores: { 1: 0, 2: 0 },
        activeUnitId: null,
        autoEndTurn: false,
    };
}
