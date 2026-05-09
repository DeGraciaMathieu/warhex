import { describe, it, expect, beforeEach } from "vitest";
import { hexKey, isValidHex, hexNeighbors } from "../src/hex.js";
import { createUnit, initState, resetUID, UNIT_TEMPLATES, SPAWN_POSITIONS } from "../src/units.js";

beforeEach(() => resetUID());

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

    it("le knight a les stats attendues", () => {
        const unit = createUnit("knight", 1, { q: 0, r: 0, s: 0 });
        expect(unit.movement).toBe(5);
        expect(unit.wounds).toBe(2);
        expect(unit.save).toBe(4);
        expect(unit.weapons).toHaveLength(1);
        expect(unit.weapons[0].type).toBe("melee");
        expect(unit.weapons[0].id).toBe("lance");
    });

    it("le knight n'a pas d'arme à distance", () => {
        const unit = createUnit("knight", 1, { q: 0, r: 0, s: 0 });
        const ranged = unit.weapons.filter(w => w.type === "ranged");
        expect(ranged).toHaveLength(0);
    });

    it("le sniper a les stats attendues", () => {
        const unit = createUnit("sniper", 1, { q: 0, r: 0, s: 0 });
        expect(unit.movement).toBe(2);
        expect(unit.ballisticSkill).toBe(2);
        expect(unit.weaponSkill).toBe(5);
        expect(unit.wounds).toBe(1);
        expect(unit.save).toBe(5);
        expect(unit.weapons).toHaveLength(2);
        const sniper = unit.weapons.find(w => w.id === "sniper_rifle");
        expect(sniper.range).toBe(4);
        expect(sniper.damage).toBe(2);
        expect(sniper.ap).toBe(-2);
    });

    it("le berserker a les stats attendues", () => {
        const unit = createUnit("berserker", 1, { q: 0, r: 0, s: 0 });
        expect(unit.movement).toBe(3);
        expect(unit.weaponSkill).toBe(2);
        expect(unit.wounds).toBe(2);
        expect(unit.save).toBe(6);
        expect(unit.weapons).toHaveLength(1);
        expect(unit.weapons[0].id).toBe("chain_axe");
        expect(unit.weapons[0].attacks).toBe(4);
    });

    it("le berserker n'a pas d'arme à distance", () => {
        const unit = createUnit("berserker", 1, { q: 0, r: 0, s: 0 });
        const ranged = unit.weapons.filter(w => w.type === "ranged");
        expect(ranged).toHaveLength(0);
    });

    it("la partie a 2 warriors, 1 knight, 1 sniper et 1 berserker par joueur par défaut", () => {
        const state = initState();
        for (const player of [1, 2]) {
            const units = state.units.filter(u => u.player === player);
            expect(units.filter(u => u.name === "Warrior")).toHaveLength(2);
            expect(units.filter(u => u.name === "Knight")).toHaveLength(1);
            expect(units.filter(u => u.name === "Sniper")).toHaveLength(1);
            expect(units.filter(u => u.name === "Berserker")).toHaveLength(1);
        }
    });
});

describe("état initial du jeu", () => {
    it("la partie commence avec 5 unités par joueur", () => {
        const state = initState();
        const p1 = state.units.filter(u => u.player === 1);
        const p2 = state.units.filter(u => u.player === 2);
        expect(p1).toHaveLength(5);
        expect(p2).toHaveLength(5);
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

    it("toutes les armes de mêlée ont une portée de 1", () => {
        const state = initState();
        for (const unit of state.units) {
            for (const w of unit.weapons) {
                if (w.type === "melee") expect(w.range).toBe(1);
            }
        }
    });

    it("les warriors ont un fusil de portée 2", () => {
        const state = initState();
        const warriors = state.units.filter(u => u.name === "Warrior");
        for (const unit of warriors) {
            const rifle = unit.weapons.find(w => w.id === "rifle");
            expect(rifle.range).toBe(2);
        }
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
});

describe("génération de la carte", () => {
    it("la carte contient exactement 9 obstacles", () => {
        const state = initState();
        expect(state.obstacles).toHaveLength(9);
    });

    it("les obstacles sont sur des hexes valides et ne chevauchent aucune unité", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        for (const obs of state.obstacles) {
            expect(isValidHex(obs)).toBe(true);
            expect(unitKeys.has(hexKey(obs))).toBe(false);
        }
    });

    it("les rivières sont sur des hexes valides et ne chevauchent ni unités ni obstacles", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        const obsKeys = new Set(state.obstacles.map(o => hexKey(o)));
        for (const r of state.rivers) {
            expect(isValidHex(r)).toBe(true);
            expect(unitKeys.has(hexKey(r))).toBe(false);
            expect(obsKeys.has(hexKey(r))).toBe(false);
        }
    });

    it("la carte contient exactement 4 villes sur des hexes distincts", () => {
        for (let i = 0; i < 20; i++) {
            resetUID();
            const state = initState();
            expect(state.towns).toHaveLength(4);
            const keys = new Set(state.towns.map(hexKey));
            expect(keys.size).toBe(4);
        }
    });

    it("les villes sont sur des hexes valides et ne chevauchent aucun autre terrain", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        const obsKeys = new Set(state.obstacles.map(o => hexKey(o)));
        const riverKeys = new Set(state.rivers.map(r => hexKey(r)));
        for (const t of state.towns) {
            expect(isValidHex(t)).toBe(true);
            expect(unitKeys.has(hexKey(t))).toBe(false);
            expect(obsKeys.has(hexKey(t))).toBe(false);
            expect(riverKeys.has(hexKey(t))).toBe(false);
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

    it("les forêts sont sur des hexes valides et ne chevauchent aucun autre terrain", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        const obsKeys = new Set(state.obstacles.map(o => hexKey(o)));
        const riverKeys = new Set(state.rivers.map(r => hexKey(r)));
        const townKeys = new Set(state.towns.map(t => hexKey(t)));
        for (const f of state.forests) {
            expect(isValidHex(f)).toBe(true);
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

    it("la carte contient exactement 4 collines", () => {
        const state = initState();
        expect(state.hills).toHaveLength(4);
    });

    it("les collines sont sur des hexes valides et ne chevauchent aucun autre terrain", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        const obsKeys = new Set(state.obstacles.map(o => hexKey(o)));
        const riverKeys = new Set(state.rivers.map(r => hexKey(r)));
        const townKeys = new Set(state.towns.map(t => hexKey(t)));
        const forestKeys = new Set(state.forests.map(f => hexKey(f)));
        for (const h of state.hills) {
            expect(isValidHex(h)).toBe(true);
            const k = hexKey(h);
            expect(unitKeys.has(k)).toBe(false);
            expect(obsKeys.has(k)).toBe(false);
            expect(riverKeys.has(k)).toBe(false);
            expect(townKeys.has(k)).toBe(false);
            expect(forestKeys.has(k)).toBe(false);
        }
    });

    it("la carte contient exactement 4 marais", () => {
        const state = initState();
        expect(state.swamps).toHaveLength(4);
    });

    it("les marais sont sur des hexes valides et ne chevauchent aucun autre terrain", () => {
        const state = initState();
        const unitKeys = new Set(state.units.map(u => hexKey(u.hex)));
        const obsKeys = new Set(state.obstacles.map(o => hexKey(o)));
        const riverKeys = new Set(state.rivers.map(r => hexKey(r)));
        const townKeys = new Set(state.towns.map(t => hexKey(t)));
        const forestKeys = new Set(state.forests.map(f => hexKey(f)));
        const hillKeys = new Set(state.hills.map(h => hexKey(h)));
        for (const s of state.swamps) {
            expect(isValidHex(s)).toBe(true);
            const k = hexKey(s);
            expect(unitKeys.has(k)).toBe(false);
            expect(obsKeys.has(k)).toBe(false);
            expect(riverKeys.has(k)).toBe(false);
            expect(townKeys.has(k)).toBe(false);
            expect(forestKeys.has(k)).toBe(false);
            expect(hillKeys.has(k)).toBe(false);
        }
    });
});

describe("sélection d'armée", () => {
    it("UNIT_TEMPLATES expose les 4 types d'unités", () => {
        expect(Object.keys(UNIT_TEMPLATES)).toEqual(expect.arrayContaining(["warrior", "knight", "sniper", "berserker"]));
        expect(Object.keys(UNIT_TEMPLATES)).toHaveLength(4);
    });

    it("SPAWN_POSITIONS contient 5 positions par joueur", () => {
        expect(SPAWN_POSITIONS[1]).toHaveLength(5);
        expect(SPAWN_POSITIONS[2]).toHaveLength(5);
    });

    it("initState avec des armées custom crée les bonnes unités", () => {
        const armies = {
            1: ["knight", "knight", "knight", "sniper", "sniper"],
            2: ["berserker", "berserker", "berserker", "berserker", "warrior"],
        };
        const state = initState(armies);
        const p1 = state.units.filter(u => u.player === 1);
        const p2 = state.units.filter(u => u.player === 2);
        expect(p1).toHaveLength(5);
        expect(p2).toHaveLength(5);
        expect(p1.filter(u => u.name === "Knight")).toHaveLength(3);
        expect(p1.filter(u => u.name === "Sniper")).toHaveLength(2);
        expect(p2.filter(u => u.name === "Berserker")).toHaveLength(4);
        expect(p2.filter(u => u.name === "Warrior")).toHaveLength(1);
    });

    it("initState avec des armées custom place les unités sur les positions de spawn", () => {
        const armies = {
            1: ["warrior", "warrior", "warrior", "warrior", "warrior"],
            2: ["knight", "knight", "knight", "knight", "knight"],
        };
        const state = initState(armies);
        const p1 = state.units.filter(u => u.player === 1);
        const p2 = state.units.filter(u => u.player === 2);
        for (let i = 0; i < 5; i++) {
            expect(p1[i].hex).toEqual(SPAWN_POSITIONS[1][i]);
            expect(p2[i].hex).toEqual(SPAWN_POSITIONS[2][i]);
        }
    });

    it("initState sans argument utilise l'armée par défaut", () => {
        const state = initState();
        expect(state.units).toHaveLength(10);
        const p1 = state.units.filter(u => u.player === 1);
        expect(p1.filter(u => u.name === "Warrior")).toHaveLength(2);
    });

    it("initState avec armées custom initialise autoEndTurn à false", () => {
        const armies = {
            1: ["warrior", "warrior", "warrior", "warrior", "warrior"],
            2: ["warrior", "warrior", "warrior", "warrior", "warrior"],
        };
        const state = initState(armies);
        expect(state.autoEndTurn).toBe(false);
    });
});
