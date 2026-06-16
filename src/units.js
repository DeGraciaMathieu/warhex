import { hexKey } from "./hex.js";

export const ACTIVATIONS_PER_TURN = 2;

export const UNIT_TEMPLATES = {
    warrior: {
        name: "Warrior", symbol: "⚔",
        movement: 3, weaponSkill: 3, ballisticSkill: 4,
        wounds: 3, save: 4,
        weapons: [
            { id: "rifle", name: "Rifle", type: "ranged", range: 2, attacks: 2, ap: -1, damage: 1 },
            { id: "sword", name: "Sword", type: "melee", range: 1, attacks: 2, ap: 0, damage: 2 },
        ],
    },
    knight: {
        name: "Knight", symbol: "🐴",
        movement: 5, weaponSkill: 3, ballisticSkill: 4,
        wounds: 2, save: 4,
        weapons: [
            { id: "lance", name: "Lance", type: "melee", range: 1, attacks: 2, ap: -1, damage: 1 },
        ],
    },
    sniper: {
        name: "Sniper", symbol: "🎯",
        movement: 2, weaponSkill: 5, ballisticSkill: 3,
        wounds: 1, save: 5,
        weapons: [
            { id: "sniper_rifle", name: "Sniper Rifle", type: "ranged", range: 3, minRange: 2, attacks: 2, ap: -2, damage: 1 },
            { id: "pistol", name: "Pistol", type: "ranged", range: 1, attacks: 1, ap: 0, damage: 1 },
        ],
    },
    berserker: {
        name: "Berserker", symbol: "🪓",
        movement: 3, weaponSkill: 2, ballisticSkill: 6,
        wounds: 2, save: 6,
        weapons: [
            { id: "chain_axe", name: "Chain Axe", type: "melee", range: 1, attacks: 4, ap: -1, damage: 1 },
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

function generateWaterBodies(reservedKeys, targetBodies = null) {
    const key = h => `${h.q},${h.r},${h.s}`;
    const isValid = h => Math.abs(h.q) <= 5 && Math.abs(h.r) <= 5 && Math.abs(h.s) <= 5;
    const allReserved = new Set(reservedKeys);
    const water = [];
    const bodyCount = targetBodies !== null ? targetBodies : 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < bodyCount; i++) {
        const start = randomAvailableHexes(1, allReserved);
        if (start.length === 0) break;
        const size = 2 + Math.floor(Math.random() * 3); // 2-4 hexes
        const body = [start[0]];
        allReserved.add(key(start[0]));

        while (body.length < size) {
            const candidates = [];
            for (const h of body) {
                for (const d of DIRECTIONS) {
                    const n = { q: h.q + d.q, r: h.r + d.r, s: h.s + d.s };
                    if (isValid(n) && !allReserved.has(key(n))) candidates.push(n);
                }
            }
            if (candidates.length === 0) break;
            const picked = candidates[Math.floor(Math.random() * candidates.length)];
            body.push(picked);
            allReserved.add(key(picked));
        }
        water.push(...body);
    }
    return water;
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

export function computeTownControl(townOwnership) {
    let p1 = 0, p2 = 0;
    for (const player of Object.values(townOwnership)) {
        if (player === 1) p1++;
        else if (player === 2) p2++;
    }
    return { 1: p1, 2: p2 };
}

export function checkWinner(scores, round) {
    if (round < 7) return null;
    if (scores[1] > scores[2]) return 1;
    if (scores[2] > scores[1]) return 2;
    return "draw";
}


export const SPAWN_POSITIONS = {
    1: [
        { q: -4, r: 0, s: 4 },
        { q: -3, r: 3, s: 0 },
        { q: -4, r: 2, s: 2 },
        { q: -3, r: -1, s: 4 },
        { q: -2, r: 3, s: -1 },
    ],
    2: [
        { q: 4, r: 0, s: -4 },
        { q: 3, r: -3, s: 0 },
        { q: 4, r: -2, s: -2 },
        { q: 3, r: 1, s: -4 },
        { q: 2, r: -3, s: 1 },
    ],
};

const DEFAULT_ARMIES = {
    1: ["warrior", "warrior", "knight", "sniper", "berserker"],
    2: ["warrior", "warrior", "knight", "sniper", "berserker"],
};

function mirrorHex(h) {
    return { q: -h.q, r: -h.r, s: -h.s };
}

function fairTownHexes(count, reservedKeys) {
    const key = h => `${h.q},${h.r},${h.s}`;
    const half = Math.floor(count / 2);
    const allHexes = [];
    for (let q = -5; q <= 5; q++) {
        for (let r = -5; r <= 5; r++) {
            const s = -q - r;
            if (Math.abs(s) <= 5) allHexes.push({ q, r, s });
        }
    }
    const candidates = allHexes.filter(h => {
        if (h.q > 0) return false;
        if (h.q === 0 && h.r >= 0) return false;
        if (reservedKeys.has(key(h))) return false;
        const m = mirrorHex(h);
        if (reservedKeys.has(key(m))) return false;
        return true;
    });
    const picked = [];
    const used = new Set();
    for (let i = 0; i < half && candidates.length > 0; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        const h = candidates.splice(idx, 1)[0];
        picked.push(h);
        used.add(key(h));
    }
    const result = [];
    for (const h of picked) {
        result.push(h);
        result.push(mirrorHex(h));
    }
    return result;
}

const TERRAIN_COUNTS = {
    obstacles: [0, 5, 9, 15],
    rivers:    [0, 2, 4, 7],
    towns:     [0, 2, 4, 6],
    forests:   [0, 2, 4, 8],
    hills:     [0, 2, 4, 8],
    swamps:    [0, 2, 4, 8],
};

export const TERRAIN_DENSITY_LABELS = ["Aucun", "Peu", "Normal", "Beaucoup"];

export const DEFAULT_TERRAIN_DENSITY = {
    obstacles: 2, rivers: 2, towns: 2, forests: 2, hills: 2, swamps: 2,
};

export const TERRAIN_PRESETS = [
    { id: "default", label: "Par défaut", icon: "⚖", desc: "Configuration standard, terrain équilibré", density: { obstacles: 2, rivers: 2, towns: 2, forests: 2, hills: 2, swamps: 2 } },
    { id: "open", label: "Plaine ouverte", icon: "🌾", desc: "Peu de terrains, lignes de tir dégagées", density: { obstacles: 1, rivers: 1, towns: 1, forests: 0, hills: 1, swamps: 0 } },
    { id: "forest", label: "Forêt dense", icon: "🌲", desc: "Beaucoup de forêts et collines, couvert abondant", density: { obstacles: 1, rivers: 1, towns: 1, forests: 3, hills: 2, swamps: 2 } },
    { id: "siege", label: "Ville assiégée", icon: "🏰", desc: "Beaucoup de villes et obstacles, combat rapproché", density: { obstacles: 3, rivers: 0, towns: 3, forests: 0, hills: 1, swamps: 0 } },
];

// Génère les terrains aléatoirement à partir des positions des unités réservées
// et de la densité choisie. Extrait d'initState pour pouvoir générer un terrain
// une seule fois (preview) puis le réutiliser tel quel au lancement de la partie.
export function generateTerrain(units, options = {}) {
    const { fairTowns = true, terrainDensity = DEFAULT_TERRAIN_DENSITY } = options;
    const centerHex = { q: 0, r: 0, s: 0 };
    const reservedKeys = new Set([...units.map(u => `${u.hex.q},${u.hex.r},${u.hex.s}`), `0,0,0`]);
    const obstacleCount = TERRAIN_COUNTS.obstacles[terrainDensity.obstacles];
    const obstacles = randomAvailableHexes(obstacleCount, reservedKeys);
    const obstacleKeys = new Set(obstacles.map(o => `${o.q},${o.r},${o.s}`));
    const allReserved = new Set([...reservedKeys, ...obstacleKeys]);
    const riverBodyCount = TERRAIN_COUNTS.rivers[terrainDensity.rivers];
    const rivers = riverBodyCount > 0 ? generateWaterBodies(allReserved, riverBodyCount) : [];
    const riverKeys = new Set(rivers.map(r => `${r.q},${r.r},${r.s}`));
    const allReserved2 = new Set([...allReserved, ...riverKeys]);
    const townCount = TERRAIN_COUNTS.towns[terrainDensity.towns];
    const towns = townCount > 0 ? (fairTowns ? fairTownHexes(townCount, allReserved2) : randomAvailableHexes(townCount, allReserved2)) : [];
    if (townCount > 0) towns.push(centerHex);
    const townKeys = new Set(towns.map(t => `${t.q},${t.r},${t.s}`));
    const allReserved3 = new Set([...allReserved2, ...townKeys]);
    const forestCount = TERRAIN_COUNTS.forests[terrainDensity.forests];
    const forests = forestCount > 0 ? generateForests(forestCount, allReserved3) : [];
    const forestKeys = new Set(forests.map(f => `${f.q},${f.r},${f.s}`));
    const allReserved4 = new Set([...allReserved3, ...forestKeys]);
    const hillCount = TERRAIN_COUNTS.hills[terrainDensity.hills];
    const hills = randomAvailableHexes(hillCount, allReserved4);
    const hillKeys = new Set(hills.map(h => `${h.q},${h.r},${h.s}`));
    const allReserved5 = new Set([...allReserved4, ...hillKeys]);
    const swampCount = TERRAIN_COUNTS.swamps[terrainDensity.swamps];
    const swamps = randomAvailableHexes(swampCount, allReserved5);
    return { obstacles, rivers, towns, forests, hills, swamps };
}

export function initState(armies, options = {}) {
    const picks = armies || DEFAULT_ARMIES;
    const units = [
        ...picks[1].map((type, i) => createUnit(type, 1, SPAWN_POSITIONS[1][i])),
        ...picks[2].map((type, i) => createUnit(type, 2, SPAWN_POSITIONS[2][i])),
    ];
    // Si un terrain a déjà été généré (preview), on le réutilise tel quel pour
    // que la carte jouée soit exactement celle prévisualisée.
    const { obstacles, rivers, towns, forests, hills, swamps } = options.terrain || generateTerrain(units, options);
    return {
        units,
        obstacles,
        rivers,
        towns,
        forests,
        hills,
        swamps,
        currentPlayer: 1,
        phase: "select",
        selectedUnit: null,
        validMoves: [],
        validTargets: [],
        attackRangeHexes: [],
        pendingAttack: null,
        pendingConsolidation: null,
        winner: null,
        round: 1,
        scores: { 1: 0, 2: 0 },
        activeUnitId: null,
        activationsUsed: 0,
        activatedUnitIds: [],
        townOwnership: {},
        autoEndTurn: false,
        dyingUnits: [],
        aiPreview: null,
        kills: { 1: 0, 2: 0 },
        scoreHistory: [],
        hitEffects: [],
        attackEffects: [],
        movingUnit: null,
    };
}
