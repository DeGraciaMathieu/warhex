const UNIT_TEMPLATES = {
    spaceMarine: {
        name: "Space Marine", symbol: "☩",
        movement: 3, weaponSkill: 3, ballisticSkill: 3,
        toughness: 4, wounds: 2, save: 3,
        weapons: [
            { id: "bolter", name: "Bolter", type: "ranged", range: 5, attacks: 2, strength: 4, ap: -1, damage: 1 },
            { id: "knife", name: "Combat Knife", type: "melee", range: 1, attacks: 3, strength: 4, ap: 0, damage: 1 },
        ],
    },
    orcBoy: {
        name: "Orc Boy", symbol: "✦",
        movement: 3, weaponSkill: 3, ballisticSkill: 5,
        toughness: 4, wounds: 1, save: 6,
        weapons: [
            { id: "choppa", name: "Choppa", type: "melee", range: 1, attacks: 3, strength: 5, ap: -1, damage: 1 },
            { id: "slugga", name: "Slugga", type: "ranged", range: 3, attacks: 1, strength: 4, ap: 0, damage: 1 },
        ],
    },
    chaosWarrior: {
        name: "Chaos Warrior", symbol: "✸",
        movement: 2, weaponSkill: 4, ballisticSkill: 4,
        toughness: 5, wounds: 3, save: 4,
        weapons: [
            { id: "chainsword", name: "Chainsword", type: "melee", range: 1, attacks: 4, strength: 5, ap: -1, damage: 2 },
            { id: "bolt_pistol", name: "Bolt Pistol", type: "ranged", range: 3, attacks: 1, strength: 4, ap: 0, damage: 1 },
        ],
    },
};

let UID = 0;

export function resetUID() { UID = 0; }

export function createUnit(type, player, hex) {
    const t = UNIT_TEMPLATES[type];
    return { ...t, id: UID++, player, hex, currentWounds: t.wounds, hasMoved: false, hasAttacked: false };
}

export function initState() {
    const units = [
        createUnit("spaceMarine", 1, { q: -4, r: 0, s: 4 }),
        createUnit("orcBoy", 1, { q: -3, r: 3, s: 0 }),
        createUnit("spaceMarine", 1, { q: -4, r: 2, s: 2 }),
        createUnit("chaosWarrior", 2, { q: 4, r: 0, s: -4 }),
        createUnit("orcBoy", 2, { q: 3, r: -3, s: 0 }),
        createUnit("chaosWarrior", 2, { q: 4, r: -2, s: -2 }),
    ];
    const obstacles = [
        { q: 0, r: 0, s: 0 },
        { q: 0, r: -1, s: 1 },
        { q: 0, r: 1, s: -1 },
        { q: -2, r: -1, s: 3 },
        { q: -2, r: -2, s: 4 },
        { q: 2, r: 1, s: -3 },
        { q: 2, r: 2, s: -4 },
        { q: -1, r: 3, s: -2 },
        { q: 1, r: -3, s: 2 },
    ];
    return {
        units,
        obstacles,
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
