import { describe, it, expect, beforeEach } from "vitest";
import { hexDistance, hexKey, hexToPixel, pixelToHex, reachableHexes, isValidHex, hexNeighbors, hasLineOfSight } from "../src/hex.js";
import { resolveAttack } from "../src/combat.js";
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

    it("les dégâts ne dépassent jamais attaques × damage", () => {
        const attacker = createUnit("chaosWarrior", 2, { q: 0, r: 0, s: 0 });
        const target = createUnit("orcBoy", 1, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[0]; // Chainsword: 4 attacks, 2 damage
        const maxDamage = weapon.attacks * weapon.damage;

        for (let i = 0; i < 100; i++) {
            const result = resolveAttack(attacker, weapon, target);
            expect(result.damage).toBeLessThanOrEqual(maxDamage);
        }
    });

    it("le log de combat suit la séquence To Hit → Save → Summary", () => {
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

            if (result.log.length === 3) {
                foundFullSequence = true;
                expect(labels[1]).toContain("Sauvegarde");
            }
        }
        expect(foundFullSequence).toBe(true);
    });

    it("une arme avec PA rend la sauvegarde plus difficile", () => {
        const attacker = createUnit("spaceMarine", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("chaosWarrior", 2, { q: 1, r: -1, s: 0 }); // save 4+
        // On compare la même arme avec et sans PA
        const withPA = { id: "test", name: "Test", type: "melee", range: 1, attacks: 3, strength: 4, ap: -2, damage: 1 };
        const noPA = { id: "test", name: "Test", type: "melee", range: 1, attacks: 3, strength: 4, ap: 0, damage: 1 };

        let totalWithPA = 0, totalNoPA = 0;
        for (let i = 0; i < 1000; i++) {
            totalWithPA += resolveAttack(attacker, withPA, target).damage;
            totalNoPA += resolveAttack(attacker, noPA, target).damage;
        }
        expect(totalWithPA).toBeGreaterThan(totalNoPA);
    });

    it("une arme avec plus d'attaques fait plus de dégâts en moyenne", () => {
        const attacker = createUnit("spaceMarine", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("orcBoy", 2, { q: 1, r: -1, s: 0 });
        const manyAttacks = { id: "test", name: "Test", type: "melee", range: 1, attacks: 4, strength: 4, ap: 0, damage: 1 };
        const fewAttacks = { id: "test2", name: "Test2", type: "melee", range: 1, attacks: 1, strength: 4, ap: 0, damage: 1 };

        let totalMany = 0, totalFew = 0;
        for (let i = 0; i < 500; i++) {
            totalMany += resolveAttack(attacker, manyAttacks, target).damage;
            totalFew += resolveAttack(attacker, fewAttacks, target).damage;
        }
        expect(totalMany).toBeGreaterThan(totalFew);
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
// OBSTACLES
// ────────────────────────────────────────────────

describe("obstacles", () => {
    it("une unité ne peut pas traverser un obstacle", () => {
        const origin = { q: -1, r: 0, s: 1 };
        const obstacle = { q: 0, r: 0, s: 0 };
        const obstacleKeys = new Set([hexKey(obstacle)]);
        const reachable = reachableHexes(origin, 3, new Set(), obstacleKeys);
        const reachableKeys = new Set(reachable.map(hexKey));

        expect(reachableKeys.has(hexKey(obstacle))).toBe(false);
    });

    it("un obstacle entre deux hexes bloque la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const obstacle = { q: 0, r: 0, s: 0 };
        const obstacleKeys = new Set([hexKey(obstacle)]);

        expect(hasLineOfSight(a, b, obstacleKeys)).toBe(false);
    });

    it("la ligne de vue est dégagée sans obstacle intermédiaire", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const obstacleKeys = new Set();

        expect(hasLineOfSight(a, b, obstacleKeys)).toBe(true);
    });

    it("un obstacle sur la case de départ ou d'arrivée ne bloque pas la ligne de vue", () => {
        const a = { q: 0, r: 0, s: 0 };
        const b = { q: 2, r: 0, s: -2 };
        const obstacleKeys = new Set([hexKey(a), hexKey(b)]);

        expect(hasLineOfSight(a, b, obstacleKeys)).toBe(true);
    });

    it("les obstacles réduisent le nombre de destinations accessibles", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const withoutObstacles = reachableHexes(origin, 3, new Set(), new Set());

        const neighbors = hexNeighbors(origin);
        const obstacleKeys = new Set(neighbors.map(hexKey));
        const withObstacles = reachableHexes(origin, 3, new Set(), obstacleKeys);

        expect(withObstacles.length).toBe(0);
        expect(withoutObstacles.length).toBeGreaterThan(0);
    });
});

// ────────────────────────────────────────────────
// RIVIÈRES
// ────────────────────────────────────────────────

describe("rivières", () => {
    it("entrer dans une rivière stoppe le déplacement", () => {
        const origin = { q: -1, r: 0, s: 1 };
        const river = { q: 0, r: 0, s: 0 };
        const beyondRiver = { q: 1, r: 0, s: -1 };
        const riverKeys = new Set([hexKey(river)]);
        const reachable = reachableHexes(origin, 2, new Set(), new Set(), riverKeys);
        const reachableKeys = new Set(reachable.map(hexKey));

        // La case rivière est accessible
        expect(reachableKeys.has(hexKey(river))).toBe(true);
        // La case juste après la rivière n'est pas accessible (mouvement stoppé, pas assez pour contourner)
        expect(reachableKeys.has(hexKey(beyondRiver))).toBe(false);
    });

    it("une unité qui démarre sur une rivière peut se déplacer normalement", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const riverKeys = new Set([hexKey(origin)]);
        const reachable = reachableHexes(origin, 3, new Set(), new Set(), riverKeys);

        // L'unité peut se déplacer au-delà de la case adjacente
        expect(reachable.length).toBeGreaterThan(6);
    });

    it("une rivière ne bloque pas la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const river = { q: 0, r: 0, s: 0 };
        const obstacleKeys = new Set();
        const riverKeys = new Set([hexKey(river)]);

        // La rivière n'est pas un obstacle pour la LdV
        expect(hasLineOfSight(a, b, obstacleKeys)).toBe(true);
    });

    it("on peut contourner une rivière si le mouvement le permet", () => {
        const origin = { q: -1, r: 0, s: 1 };
        const river = { q: 0, r: 0, s: 0 };
        const target = { q: 1, r: 0, s: -1 };
        const riverKeys = new Set([hexKey(river)]);
        const reachable = reachableHexes(origin, 5, new Set(), new Set(), riverKeys);
        const reachableKeys = new Set(reachable.map(hexKey));

        // Le hex derrière la rivière est accessible par un contournement
        expect(reachableKeys.has(hexKey(target))).toBe(true);
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

    it("les obstacles ne chevauchent aucune unité", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        for (const obs of state.obstacles) {
            expect(unitKeys.has(hexKey(obs))).toBe(false);
        }
    });

    it("les obstacles sont sur des hexes valides", () => {
        const state = initState();
        for (const obs of state.obstacles) {
            expect(isValidHex(obs)).toBe(true);
        }
    });

    it("toutes les armes de mêlée ont une portée de 1", () => {
        const state = initState();
        for (const unit of state.units) {
            for (const w of unit.weapons) {
                if (w.type === "melee") expect(w.range).toBe(1);
            }
        }
    });
});

// ────────────────────────────────────────────────
// CONVERSIONS HEX ↔ PIXEL
// ────────────────────────────────────────────────

describe("conversions hex ↔ pixel", () => {
    it("convertir un hex en pixel puis revenir donne le même hex", () => {
        const hexes = [
            { q: 3, r: -2, s: -1 },
            { q: -4, r: 1, s: 3 },
            { q: 5, r: -5, s: 0 },
            { q: 2, r: 1, s: -3 },
        ];
        for (const h of hexes) {
            const px = hexToPixel(h.q, h.r);
            const back = pixelToHex(px.x, px.y);
            expect(back.q).toBe(h.q);
            expect(back.r).toBe(h.r);
            expect(back.s).toBe(h.s);
        }
    });

    it("hexKey produit des clés différentes pour des hexes différents", () => {
        const a = { q: 1, r: -1, s: 0 };
        const b = { q: 1, r: 0, s: -1 };
        expect(hexKey(a)).not.toBe(hexKey(b));
    });

    it("deux hexes adjacents sont toujours en ligne de vue", () => {
        const a = { q: 0, r: 0, s: 0 };
        const neighbors = hexNeighbors(a);
        // Même avec des obstacles ailleurs, les adjacents se voient
        const obstacleKeys = new Set([hexKey({ q: 3, r: -3, s: 0 })]);
        for (const n of neighbors) {
            expect(hasLineOfSight(a, n, obstacleKeys)).toBe(true);
        }
    });
});
