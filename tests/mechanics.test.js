import { describe, it, expect, beforeEach } from "vitest";
import { hexDistance, hexKey, reachableHexes, isValidHex, hexNeighbors } from "../src/hex.js";
import { resolveAttack, woundThreshold } from "../src/combat.js";
import { createUnit, initState, resetUID } from "../src/units.js";

beforeEach(() => resetUID());

// ────────────────────────────────────────────────
// DÉPLACEMENT
// ────────────────────────────────────────────────

describe("déplacement", () => {
    it("une unité avec mouvement 3 peut atteindre des hexes à 3 cases mais pas à 4", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const reachable = reachableHexes(origin, 3, new Set());
        const reachableKeys = new Set(reachable.map(hexKey));

        // Un hex adjacent (distance 1) est accessible
        expect(reachableKeys.has(hexKey({ q: 1, r: -1, s: 0 }))).toBe(true);

        // Un hex à distance 3 est accessible
        expect(reachableKeys.has(hexKey({ q: 3, r: -3, s: 0 }))).toBe(true);

        // Un hex à distance 4 n'est pas accessible
        expect(reachableKeys.has(hexKey({ q: 4, r: -4, s: 0 }))).toBe(false);
    });

    it("une unité ne peut pas traverser un hex occupé", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const blocker = { q: 1, r: -1, s: 0 }; // bloque la direction nord-est
        const occupied = new Set([hexKey(blocker)]);
        const reachable = reachableHexes(origin, 3, occupied);
        const reachableKeys = new Set(reachable.map(hexKey));

        // L'hex occupé n'est pas dans les destinations possibles
        expect(reachableKeys.has(hexKey(blocker))).toBe(false);

        // Un hex derrière le bloqueur peut être atteint par un autre chemin
        const behindBlocker = { q: 2, r: -2, s: 0 };
        // Ce hex est accessible si un chemin alternatif existe (et il existe via d'autres directions)
        // Le test vérifie juste que le bloqueur lui-même est exclu
    });

    it("une unité ne peut pas se déplacer hors de la grille", () => {
        const edgeHex = { q: 5, r: -5, s: 0 };
        const reachable = reachableHexes(edgeHex, 2, new Set());

        // Tous les hexes retournés doivent être valides
        for (const hex of reachable) {
            expect(isValidHex(hex)).toBe(true);
        }
    });

    it("le mouvement 0 ne produit aucune destination", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const reachable = reachableHexes(origin, 0, new Set());
        expect(reachable).toHaveLength(0);
    });
});

// ────────────────────────────────────────────────
// COMBAT
// ────────────────────────────────────────────────

describe("combat", () => {
    it("une attaque produit toujours un résultat avec des dégâts >= 0", () => {
        const attacker = createUnit("spaceMarine", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("orcBoy", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[0]; // Bolter

        for (let i = 0; i < 50; i++) {
            const result = resolveAttack(attacker, weapon, target);
            expect(result.damage).toBeGreaterThanOrEqual(0);
            expect(result.log.length).toBeGreaterThanOrEqual(2); // au minimum To Hit + Summary
        }
    });

    it("les dégâts ne dépassent jamais attaques × damage de l'arme", () => {
        const attacker = createUnit("chaosWarrior", 2, { q: 0, r: 0, s: 0 });
        const target = createUnit("orcBoy", 1, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[0]; // Chainsword: 4 attacks, 2 damage
        const maxDamage = weapon.attacks * weapon.damage;

        for (let i = 0; i < 100; i++) {
            const result = resolveAttack(attacker, weapon, target);
            expect(result.damage).toBeLessThanOrEqual(maxDamage);
        }
    });

    it("le log de combat suit la séquence To Hit → To Wound → Save → Summary", () => {
        const attacker = createUnit("spaceMarine", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("chaosWarrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[1]; // Combat Knife (melee)

        // On lance assez de fois pour avoir au moins un combat complet
        let foundFullSequence = false;
        for (let i = 0; i < 200; i++) {
            const result = resolveAttack(attacker, weapon, target);
            const labels = result.log.map(e => e.label);

            // Le premier est toujours To Hit
            expect(labels[0]).toContain("To Hit");

            // Le dernier est toujours le summary des dégâts
            expect(labels[labels.length - 1]).toContain("Dégâts infligés");

            if (result.log.length === 4) {
                foundFullSequence = true;
                expect(labels[1]).toContain("To Wound");
                expect(labels[2]).toContain("Sauvegarde");
            }
        }
        expect(foundFullSequence).toBe(true);
    });
});

// ────────────────────────────────────────────────
// SEUILS DE BLESSURE (table Warhammer)
// ────────────────────────────────────────────────

describe("table de blessure", () => {
    it("force double de l'endurance → seuil 2+", () => {
        expect(woundThreshold(8, 4)).toBe(2);
    });

    it("force supérieure à l'endurance → seuil 3+", () => {
        expect(woundThreshold(5, 4)).toBe(3);
    });

    it("force égale à l'endurance → seuil 4+", () => {
        expect(woundThreshold(4, 4)).toBe(4);
    });

    it("force inférieure à l'endurance → seuil 5+", () => {
        expect(woundThreshold(3, 4)).toBe(5);
    });

    it("force moitié de l'endurance → seuil 6+", () => {
        expect(woundThreshold(2, 4)).toBe(6);
    });
});

// ────────────────────────────────────────────────
// DISTANCE HEXAGONALE
// ────────────────────────────────────────────────

describe("distance hexagonale", () => {
    it("la distance entre un hex et lui-même est 0", () => {
        const hex = { q: 2, r: -1, s: -1 };
        expect(hexDistance(hex, hex)).toBe(0);
    });

    it("des hexes adjacents sont à distance 1", () => {
        const a = { q: 0, r: 0, s: 0 };
        const neighbors = hexNeighbors(a);
        for (const n of neighbors) {
            expect(hexDistance(a, n)).toBe(1);
        }
    });

    it("la distance est symétrique", () => {
        const a = { q: -3, r: 1, s: 2 };
        const b = { q: 2, r: -4, s: 2 };
        expect(hexDistance(a, b)).toBe(hexDistance(b, a));
    });
});

// ────────────────────────────────────────────────
// ÉTAT INITIAL
// ────────────────────────────────────────────────

describe("état initial du jeu", () => {
    it("la partie commence avec 3 unités par joueur", () => {
        const state = initState();
        const p1 = state.units.filter(u => u.player === 1);
        const p2 = state.units.filter(u => u.player === 2);
        expect(p1).toHaveLength(3);
        expect(p2).toHaveLength(3);
    });

    it("toutes les unités commencent avec leurs PV max", () => {
        const state = initState();
        for (const unit of state.units) {
            expect(unit.currentWounds).toBe(unit.wounds);
        }
    });

    it("aucune unité n'a déjà agi au début", () => {
        const state = initState();
        for (const unit of state.units) {
            expect(unit.hasMoved).toBe(false);
            expect(unit.hasAttacked).toBe(false);
        }
    });

    it("c'est au joueur 1 de commencer", () => {
        const state = initState();
        expect(state.currentPlayer).toBe(1);
        expect(state.phase).toBe("select");
        expect(state.winner).toBeNull();
    });

    it("chaque unité a au moins une arme", () => {
        const state = initState();
        for (const unit of state.units) {
            expect(unit.weapons.length).toBeGreaterThanOrEqual(1);
        }
    });

    it("les deux camps sont positionnés sur des hexes différents", () => {
        const state = initState();
        const keys = state.units.map(u => hexKey(u.hex));
        const unique = new Set(keys);
        expect(unique.size).toBe(keys.length);
    });
});
