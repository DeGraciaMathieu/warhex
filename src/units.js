const UNIT_TEMPLATES = {
    warrior: {
        name: "Warrior", symbol: "⚔",
        movement: 3, weaponSkill: 3, ballisticSkill: 4,
        toughness: 4, wounds: 2, save: 4,
        weapons: [
            { id: "rifle", name: "Rifle", type: "ranged", range: 4, attacks: 2, strength: 4, ap: -1, damage: 1 },
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
    const startQ = Math.floor(Math.random() * 5) - 2;
    let current = { q: startQ, r: -5, s: -startQ + 5 };
    if (!isValid(current)) current = { q: 0, r: -5, s: 5 };
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
    return {
        units,
        obstacles,
        rivers,
        towns,
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
    };
}
