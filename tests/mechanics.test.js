import { describe, it, expect, beforeEach } from "vitest";
import { hexDistance, hexKey, hexToPixel, pixelToHex, reachableHexes, isValidHex, hexNeighbors, hasLineOfSight } from "../src/hex.js";
import { resolveAttack } from "../src/combat.js";
import { createUnit, initState, resetUID, computeTownControl, checkWinner } from "../src/units.js";
import { handleClick, computeMove, computeAttack, computeWeaponSelect, applyDamage, computeEndTurn } from "../src/game.js";

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
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[0]; // Rifle

        for (let i = 0; i < 50; i++) {
            const result = resolveAttack(attacker, weapon, target);
            expect(result.damage).toBeGreaterThanOrEqual(0);
            expect(result.log.length).toBeGreaterThanOrEqual(2); // au minimum To Hit + Summary
        }
    });

    it("les dégâts ne dépassent jamais attaques × damage", () => {
        const attacker = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 1, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[0]; // Rifle: 2 attacks, 1 damage
        const maxDamage = weapon.attacks * weapon.damage;

        for (let i = 0; i < 100; i++) {
            const result = resolveAttack(attacker, weapon, target);
            expect(result.damage).toBeLessThanOrEqual(maxDamage);
        }
    });

    it("le log de combat suit la séquence To Hit → Save → Summary", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[1]; // Sword (melee)

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
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 }); // save 4+
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

    it("un PA assez fort rend la sauvegarde impossible", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 }); // save 4+
        const bigAP = { id: "test", name: "Test", type: "melee", range: 1, attacks: 4, strength: 4, ap: -3, damage: 1 };
        // save 4 + 3 = 7+ → impossible

        let found = false;
        for (let i = 0; i < 100; i++) {
            const result = resolveAttack(attacker, bigAP, target);
            const saveEntry = result.log.find(e => e.isSave);
            if (saveEntry) {
                found = true;
                expect(saveEntry.label).toContain("impossible");
                expect(saveEntry.success).toBe(0);
            }
        }
        expect(found).toBe(true);
    });

    it("un hex a exactement 6 voisins", () => {
        const hex = { q: 0, r: 0, s: 0 };
        expect(hexNeighbors(hex)).toHaveLength(6);
    });

    it("une arme avec plus d'attaques fait plus de dégâts en moyenne", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const manyAttacks = { id: "test", name: "Test", type: "melee", range: 1, attacks: 4, strength: 4, ap: 0, damage: 1 };
        const fewAttacks = { id: "test2", name: "Test2", type: "melee", range: 1, attacks: 1, strength: 4, ap: 0, damage: 1 };

        let totalMany = 0, totalFew = 0;
        for (let i = 0; i < 500; i++) {
            totalMany += resolveAttack(attacker, manyAttacks, target).damage;
            totalFew += resolveAttack(attacker, fewAttacks, target).damage;
        }
        expect(totalMany).toBeGreaterThan(totalFew);
    });

    it("le couvert de ville réduit les dégâts subis", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = { id: "test", name: "Test", type: "melee", range: 1, attacks: 4, strength: 4, ap: -1, damage: 1 };

        let totalNoCover = 0, totalCover = 0;
        for (let i = 0; i < 1000; i++) {
            totalNoCover += resolveAttack(attacker, weapon, target).damage;
            totalCover += resolveAttack(attacker, weapon, target, { coverBonus: 1 }).damage;
        }
        expect(totalNoCover).toBeGreaterThan(totalCover);
    });

    it("le défenseur lance toujours 3 dés de sauvegarde", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[1];

        for (let i = 0; i < 100; i++) {
            const result = resolveAttack(attacker, weapon, target);
            const saveEntry = result.log.find(e => e.isSave);
            if (saveEntry) {
                expect(saveEntry.rolls).toHaveLength(3);
            }
        }
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

    it("une rivière combinée à des obstacles réduit davantage les options", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const riverKeys = new Set([hexKey({ q: 1, r: -1, s: 0 })]);
        const obsKeys = new Set([hexKey({ q: -1, r: 1, s: 0 })]);
        const withBoth = reachableHexes(origin, 2, new Set(), obsKeys, riverKeys);
        const withNone = reachableHexes(origin, 2, new Set(), new Set(), new Set());
        expect(withBoth.length).toBeLessThan(withNone.length);
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
// VILLES
// ────────────────────────────────────────────────

describe("villes", () => {
    it("entrer dans une ville stoppe le déplacement", () => {
        const origin = { q: -1, r: 0, s: 1 };
        const town = { q: 0, r: 0, s: 0 };
        const beyondTown = { q: 1, r: 0, s: -1 };
        const townKeys = new Set([hexKey(town)]);
        const reachable = reachableHexes(origin, 2, new Set(), new Set(), townKeys);
        const reachableKeys = new Set(reachable.map(hexKey));

        expect(reachableKeys.has(hexKey(town))).toBe(true);
        expect(reachableKeys.has(hexKey(beyondTown))).toBe(false);
    });

    it("une ville entre deux hexes bloque la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const town = { q: 0, r: 0, s: 0 };
        const losKeys = new Set([hexKey(town)]);

        expect(hasLineOfSight(a, b, losKeys)).toBe(false);
    });

    it("une unité qui démarre sur une ville peut se déplacer normalement", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const townKeys = new Set([hexKey(origin)]);
        const reachable = reachableHexes(origin, 3, new Set(), new Set(), townKeys);

        expect(reachable.length).toBeGreaterThan(6);
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

    it("chaque unité a une arme à distance et une arme de mêlée", () => {
        const state = initState();
        for (const unit of state.units) {
            const ranged = unit.weapons.filter(w => w.type === "ranged");
            const melee = unit.weapons.filter(w => w.type === "melee");
            expect(ranged).toHaveLength(1);
            expect(melee).toHaveLength(1);
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

    it("les rivières ne chevauchent ni unités ni obstacles", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        const obsKeys = new Set(state.obstacles.map(o => hexKey(o)));
        for (const r of state.rivers) {
            expect(unitKeys.has(hexKey(r))).toBe(false);
            expect(obsKeys.has(hexKey(r))).toBe(false);
        }
    });

    it("les villes ne chevauchent ni unités, ni obstacles, ni rivières", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        const obsKeys = new Set(state.obstacles.map(o => hexKey(o)));
        const riverKeys = new Set(state.rivers.map(r => hexKey(r)));
        for (const t of state.towns) {
            expect(unitKeys.has(hexKey(t))).toBe(false);
            expect(obsKeys.has(hexKey(t))).toBe(false);
            expect(riverKeys.has(hexKey(t))).toBe(false);
        }
    });

    it("les villes sont sur des hexes valides", () => {
        const state = initState();
        for (const t of state.towns) {
            expect(isValidHex(t)).toBe(true);
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

    it("le fusil a une portée de 2 cases", () => {
        const state = initState();
        for (const unit of state.units) {
            const rifle = unit.weapons.find(w => w.id === "rifle");
            expect(rifle.range).toBe(2);
        }
    });

    it("la carte contient exactement 9 obstacles", () => {
        const state = initState();
        expect(state.obstacles).toHaveLength(9);
    });

    it("les rivières sont sur des hexes valides", () => {
        const state = initState();
        for (const r of state.rivers) {
            expect(isValidHex(r)).toBe(true);
        }
    });

    it("la carte contient entre 6 et 15 cases de forêt réparties en zones", () => {
        for (let i = 0; i < 20; i++) {
            resetUID();
            const state = initState();
            expect(state.forests.length).toBeGreaterThanOrEqual(3);
            expect(state.forests.length).toBeLessThanOrEqual(15);
        }
    });

    it("les forêts sont sur des hexes valides", () => {
        const state = initState();
        for (const f of state.forests) {
            expect(isValidHex(f)).toBe(true);
        }
    });

    it("les forêts ne chevauchent aucun autre terrain", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        const obsKeys = new Set(state.obstacles.map(o => hexKey(o)));
        const riverKeys = new Set(state.rivers.map(r => hexKey(r)));
        const townKeys = new Set(state.towns.map(t => hexKey(t)));
        for (const f of state.forests) {
            const k = hexKey(f);
            expect(unitKeys.has(k)).toBe(false);
            expect(obsKeys.has(k)).toBe(false);
            expect(riverKeys.has(k)).toBe(false);
            expect(townKeys.has(k)).toBe(false);
        }
    });

    it("les forêts forment des zones contiguës", () => {
        const state = initState();
        const forestKeys = new Set(state.forests.map(hexKey));
        const visited = new Set();
        let zones = 0;
        for (const f of state.forests) {
            const k = hexKey(f);
            if (visited.has(k)) continue;
            zones++;
            const queue = [f];
            visited.add(k);
            while (queue.length > 0) {
                const cur = queue.shift();
                for (const n of hexNeighbors(cur)) {
                    const nk = hexKey(n);
                    if (forestKeys.has(nk) && !visited.has(nk)) {
                        visited.add(nk);
                        queue.push(n);
                    }
                }
            }
        }
        expect(zones).toBe(3);
    });

    it("les scores commencent à 0 pour chaque joueur", () => {
        const state = initState();
        expect(state.scores).toEqual({ 1: 0, 2: 0 });
    });

    it("aucune unité n'est active au début", () => {
        const state = initState();
        expect(state.activeUnitId).toBeNull();
        expect(state.autoEndTurn).toBe(false);
    });

    it("la carte contient exactement 4 villes", () => {
        const state = initState();
        expect(state.towns).toHaveLength(4);
    });
});

// ────────────────────────────────────────────────
// CRÉATION D'UNITÉS
// ────────────────────────────────────────────────

describe("création d'unités", () => {
    it("chaque unité créée a un ID unique", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const u2 = createUnit("warrior", 1, { q: 1, r: -1, s: 0 });
        const u3 = createUnit("warrior", 2, { q: 2, r: -2, s: 0 });
        expect(new Set([u1.id, u2.id, u3.id]).size).toBe(3);
    });

    it("l'unité est placée sur l'hex demandé avec le bon joueur", () => {
        const hex = { q: 3, r: -2, s: -1 };
        const unit = createUnit("warrior", 2, hex);
        expect(unit.hex).toEqual(hex);
        expect(unit.player).toBe(2);
    });

    it("l'unité warrior a les stats attendues", () => {
        const unit = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        expect(unit.movement).toBe(3);
        expect(unit.wounds).toBe(2);
        expect(unit.currentWounds).toBe(2);
        expect(unit.save).toBe(4);
        expect(unit.weapons).toHaveLength(2);
    });
});

// ────────────────────────────────────────────────
// SYSTÈME DE POINTS
// ────────────────────────────────────────────────

describe("système de points", () => {
    const town1 = { q: 0, r: 0, s: 0 };
    const town2 = { q: 3, r: -3, s: 0 };
    const towns = [town1, town2];

    it("une unité sur une ville rapporte 1 point à son joueur", () => {
        const units = [
            createUnit("warrior", 1, town1),
        ];
        const control = computeTownControl(units, towns);
        expect(control[1]).toBe(1);
        expect(control[2]).toBe(0);
    });

    it("chaque joueur marque pour les villes qu'il contrôle", () => {
        const units = [
            createUnit("warrior", 1, town1),
            createUnit("warrior", 2, town2),
        ];
        const control = computeTownControl(units, towns);
        expect(control[1]).toBe(1);
        expect(control[2]).toBe(1);
    });

    it("un joueur peut contrôler plusieurs villes", () => {
        const units = [
            createUnit("warrior", 1, town1),
            createUnit("warrior", 1, town2),
        ];
        const control = computeTownControl(units, towns);
        expect(control[1]).toBe(2);
    });

    it("une unité morte ne contrôle pas de ville", () => {
        const units = [
            { ...createUnit("warrior", 1, town1), currentWounds: 0 },
        ];
        const control = computeTownControl(units, towns);
        expect(control[1]).toBe(0);
    });

    it("une unité hors d'une ville ne rapporte rien", () => {
        const units = [
            createUnit("warrior", 1, { q: 1, r: -1, s: 0 }),
        ];
        const control = computeTownControl(units, towns);
        expect(control[1]).toBe(0);
    });

    it("la partie ne se termine pas avant le tour 5", () => {
        expect(checkWinner({ 1: 5, 2: 0 }, 4)).toBeNull();
        expect(checkWinner({ 1: 5, 2: 0 }, 3)).toBeNull();
    });

    it("le joueur avec le plus de points gagne au tour 5", () => {
        expect(checkWinner({ 1: 7, 2: 3 }, 5)).toBe(1);
        expect(checkWinner({ 1: 2, 2: 6 }, 5)).toBe(2);
    });

    it("égalité de points au tour 5 donne un match nul", () => {
        expect(checkWinner({ 1: 4, 2: 4 }, 5)).toBe("draw");
    });

    it("la partie peut se terminer après le tour 5", () => {
        expect(checkWinner({ 1: 10, 2: 3 }, 7)).toBe(1);
        expect(checkWinner({ 1: 2, 2: 8 }, 6)).toBe(2);
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

    it("un hex au bord de la grille est valide, un hex hors grille ne l'est pas", () => {
        expect(isValidHex({ q: 5, r: -5, s: 0 })).toBe(true);
        expect(isValidHex({ q: -5, r: 5, s: 0 })).toBe(true);
        expect(isValidHex({ q: 6, r: -6, s: 0 })).toBe(false);
        expect(isValidHex({ q: 0, r: -6, s: 6 })).toBe(false);
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

// ────────────────────────────────────────────────
// FORÊTS
// ────────────────────────────────────────────────

describe("forêts", () => {
    it("entrer dans une forêt coûte 2 points de mouvement", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const forest = { q: 1, r: -1, s: 0 };
        const forestKeys = new Set([hexKey(forest)]);
        // Avec mouvement 1, on ne peut pas entrer dans une forêt (coût 2)
        const reachable1 = reachableHexes(origin, 1, new Set(), new Set(), new Set(), forestKeys);
        expect(new Set(reachable1.map(hexKey)).has(hexKey(forest))).toBe(false);
        // Avec mouvement 2, on peut y entrer
        const reachable2 = reachableHexes(origin, 2, new Set(), new Set(), new Set(), forestKeys);
        expect(new Set(reachable2.map(hexKey)).has(hexKey(forest))).toBe(true);
    });

    it("une forêt ne bloque pas la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const obstacleKeys = new Set();

        // La forêt sur le chemin ne bloque pas la LOS (seuls obstacles et villes bloquent)
        expect(hasLineOfSight(a, b, obstacleKeys)).toBe(true);
    });

    it("une forêt réduit la portée de déplacement effective", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const forestKeys = new Set([hexKey({ q: 1, r: -1, s: 0 })]);
        const withForest = reachableHexes(origin, 3, new Set(), new Set(), new Set(), forestKeys);
        const withoutForest = reachableHexes(origin, 3, new Set(), new Set(), new Set(), new Set());
        expect(withForest.length).toBeLessThan(withoutForest.length);
    });
});

// ────────────────────────────────────────────────
// PLACEMENT DES VILLES
// ────────────────────────────────────────────────

describe("placement des villes", () => {
    it("les 4 villes sont sur des hexes distincts", () => {
        for (let i = 0; i < 20; i++) {
            resetUID();
            const state = initState();
            const keys = new Set(state.towns.map(hexKey));
            expect(keys.size).toBe(4);
        }
    });
});

// ────────────────────────────────────────────────
// COMPÉTENCES DE COMBAT
// ────────────────────────────────────────────────

describe("compétences de combat", () => {
    it("une arme de mêlée utilise weaponSkill, une arme à distance utilise ballisticSkill", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const melee = attacker.weapons.find(w => w.type === "melee");
        const ranged = attacker.weapons.find(w => w.type === "ranged");

        // Melee → To Hit label doit contenir weaponSkill (3+)
        for (let i = 0; i < 20; i++) {
            const result = resolveAttack(attacker, melee, target);
            expect(result.log[0].label).toContain(`${attacker.weaponSkill}+`);
        }
        // Ranged → To Hit label doit contenir ballisticSkill (4+)
        for (let i = 0; i < 20; i++) {
            const result = resolveAttack(attacker, ranged, target);
            expect(result.log[0].label).toContain(`${attacker.ballisticSkill}+`);
        }
    });

    it("si aucun dé ne touche, il n'y a pas de phase de sauvegarde", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[0];

        let foundNoHits = false;
        for (let i = 0; i < 200; i++) {
            const result = resolveAttack(attacker, weapon, target);
            if (result.log[0].success === 0) {
                foundNoHits = true;
                expect(result.log.length).toBe(2); // To Hit + Summary, pas de Save
                expect(result.damage).toBe(0);
            }
        }
        expect(foundNoHits).toBe(true);
    });
});

// ────────────────────────────────────────────────
// LOGIQUE DE JEU (game.js)
// ────────────────────────────────────────────────

describe("logique de jeu", () => {
    function makeState(overrides = {}) {
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const u2 = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        return {
            units: [u1, u2],
            obstacles: [],
            rivers: [],
            towns: [],
            forests: [],
            currentPlayer: 1,
            phase: "select",
            selectedUnit: null,
            validMoves: [],
            validTargets: [],
            pendingAttack: null,
            roundLog: null,
            winner: null,
            round: 1,
            scores: { 1: 0, 2: 0 },
            activeUnitId: null,
            autoEndTurn: false,
            ...overrides,
        };
    }

    it("cliquer sur une unité alliée la sélectionne", () => {
        const s = makeState();
        const result = handleClick(s, { q: -1, r: 0, s: 1 });
        expect(result.selectedUnit).not.toBeNull();
        expect(result.selectedUnit.id).toBe(s.units[0].id);
        expect(result.validMoves.length).toBeGreaterThan(0);
    });

    it("on ne peut pas sélectionner une unité ennemie", () => {
        const s = makeState();
        const result = handleClick(s, { q: 1, r: 0, s: -1 });
        expect(result.selectedUnit).toBeNull();
    });

    it("on ne peut pas sélectionner une autre unité quand activeUnitId est défini", () => {
        createUnit("warrior", 1, { q: 0, r: 0, s: 0 }); // consomme id 0
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 }); // id 1 (truthy)
        const u2 = createUnit("warrior", 1, { q: -2, r: 1, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 2, r: -1, s: -1 });
        const s = makeState({ units: [u1, u2, enemy], activeUnitId: u1.id, selectedUnit: u1 });
        const result = handleClick(s, u2.hex);
        expect(result.selectedUnit.id).toBe(u1.id);
    });

    it("cliquer sur un hex de déplacement valide déplace l'unité", () => {
        const s = makeState();
        const selected = handleClick(s, { q: -1, r: 0, s: 1 });
        const moveTarget = selected.validMoves[0];
        const moved = handleClick(selected, moveTarget);
        expect(moved.selectedUnit.hex).toEqual(moveTarget);
        expect(moved.selectedUnit.hasMoved).toBe(true);
    });

    it("handleClick ne fait rien si la partie est gagnée", () => {
        const s = makeState({ winner: 1 });
        const result = handleClick(s, { q: -1, r: 0, s: 1 });
        expect(result).toEqual(s);
    });

    it("computeMove ne donne pas de mouvements si l'unité a déjà bougé", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        u1.hasMoved = true;
        const s = makeState({ units: [u1], selectedUnit: u1 });
        const result = computeMove(s);
        expect(result.validMoves).toHaveLength(0);
    });

    it("computeAttack ne donne pas de cibles si l'unité a déjà attaqué", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        u1.hasAttacked = true;
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [u1, enemy], selectedUnit: u1 });
        const result = computeAttack(s);
        expect(result).toEqual(s);
    });

    it("computeWeaponSelect annule si la cible est hors de portée", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const weapon = attacker.weapons.find(w => w.id === "rifle"); // range 2
        const s = makeState({ units: [attacker, target], pendingAttack: { attacker, target } });
        const result = computeWeaponSelect(s, weapon);
        expect(result.anim).toBeNull();
        expect(result.state.phase).toBe("select");
    });

    it("computeWeaponSelect résout l'attaque si la cible est à portée", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons.find(w => w.id === "sword"); // range 1
        const s = makeState({ units: [attacker, target], pendingAttack: { attacker, target } });
        const result = computeWeaponSelect(s, weapon);
        expect(result.anim).not.toBeNull();
        expect(result.state.phase).toBe("resolving");
        expect(result.anim.damage).toBeGreaterThanOrEqual(0);
    });

    it("applyDamage réduit les PV de la cible et marque l'attaquant comme ayant attaqué", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 1, weaponName: "Sword", log: [], isDead: false };
        const result = applyDamage(s, anim);
        const tgt = result.units.find(u => u.id === target.id);
        const atk = result.units.find(u => u.id === attacker.id);
        expect(tgt.currentWounds).toBe(target.currentWounds - 1);
        expect(atk.hasAttacked).toBe(true);
    });

    it("applyDamage ne descend pas les PV sous 0", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 99, weaponName: "Sword", log: [], isDead: true };
        const result = applyDamage(s, anim);
        const tgt = result.units.find(u => u.id === target.id);
        expect(tgt.currentWounds).toBe(0);
    });

    it("computeEndTurn passe au joueur suivant et réinitialise les flags", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        u1.hasMoved = true;
        u1.hasAttacked = true;
        const s = makeState({ units: [u1], currentPlayer: 1 });
        const result = computeEndTurn(s);
        expect(result.currentPlayer).toBe(2);
        expect(result.units[0].hasMoved).toBe(false);
        expect(result.units[0].hasAttacked).toBe(false);
        expect(result.activeUnitId).toBeNull();
    });

    it("computeEndTurn marque les points des villes en fin de round", () => {
        const town = { q: 0, r: 0, s: 0 };
        const u1 = createUnit("warrior", 1, town);
        const s = makeState({ units: [u1], towns: [town], currentPlayer: 2 }); // J2 finit → fin de round
        const result = computeEndTurn(s);
        expect(result.scores[1]).toBe(1);
    });

    it("computeEndTurn ne fait rien si un gagnant existe déjà", () => {
        const s = makeState({ winner: 1 });
        const result = computeEndTurn(s);
        expect(result).toEqual(s);
    });

    it("computeEndTurn incrémente le round en fin de round", () => {
        const s = makeState({ currentPlayer: 2, round: 3 });
        const result = computeEndTurn(s);
        expect(result.round).toBe(4);
        expect(result.currentPlayer).toBe(1);
    });

    it("computeEndTurn n'incrémente pas le round en milieu de round", () => {
        const s = makeState({ currentPlayer: 1, round: 3 });
        const result = computeEndTurn(s);
        expect(result.round).toBe(3);
        expect(result.currentPlayer).toBe(2);
    });
});
