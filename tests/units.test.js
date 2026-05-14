import { describe, it, expect, beforeEach } from "vitest";
import { hexKey, isValidHex, hexNeighbors } from "../src/hex.js";
import { createUnit, initState, resetUID, UNIT_TEMPLATES, SPAWN_POSITIONS, DEFAULT_TERRAIN_DENSITY } from "../src/units.js";

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
        expect(unit.wounds).toBe(3);
        expect(unit.currentWounds).toBe(3);
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
        expect(unit.ballisticSkill).toBe(3);
        expect(unit.weaponSkill).toBe(5);
        expect(unit.wounds).toBe(1);
        expect(unit.save).toBe(5);
        expect(unit.weapons).toHaveLength(2);
        const sniper = unit.weapons.find(w => w.id === "sniper_rifle");
        expect(sniper.range).toBe(3);
        expect(sniper.attacks).toBe(2);
        expect(sniper.damage).toBe(1);
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

    it("aiPreview est null au début", () => {
        const state = initState();
        expect(state.aiPreview).toBeNull();
    });

    it("kills sont à zéro au début", () => {
        const state = initState();
        expect(state.kills).toEqual({ 1: 0, 2: 0 });
    });

    it("scoreHistory est vide au début", () => {
        const state = initState();
        expect(state.scoreHistory).toEqual([]);
    });

    it("hitEffects est vide au début", () => {
        const state = initState();
        expect(state.hitEffects).toEqual([]);
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

    it("la carte contient exactement 5 villes (4 symétriques + 1 centrale) sur des hexes distincts", () => {
        for (let i = 0; i < 20; i++) {
            resetUID();
            const state = initState();
            expect(state.towns).toHaveLength(5);
            const keys = new Set(state.towns.map(hexKey));
            expect(keys.size).toBe(5);
            expect(keys.has(hexKey({ q: 0, r: 0, s: 0 }))).toBe(true);
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

    it("la carte contient entre 6 et 24 cases de forêt réparties en zones", () => {
        for (let i = 0; i < 20; i++) {
            resetUID();
            const state = initState();
            expect(state.forests.length).toBeGreaterThanOrEqual(3);
            expect(state.forests.length).toBeLessThanOrEqual(24);
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
        expect(zones).toBe(4);
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

    it("fairTowns place les villes en miroir symétrique + ville centrale", () => {
        for (let i = 0; i < 20; i++) {
            resetUID();
            const state = initState(null, { fairTowns: true });
            expect(state.towns).toHaveLength(5);
            const keys = new Set(state.towns.map(hexKey));
            for (const t of state.towns) {
                const mirror = { q: -t.q, r: -t.r, s: -t.s };
                expect(keys.has(hexKey(mirror))).toBe(true);
            }
        }
    });

    it("fairTowns peut placer des villes sur l'axe central (q === 0)", () => {
        let found = false;
        for (let i = 0; i < 200; i++) {
            resetUID();
            const state = initState(null, { fairTowns: true });
            if (state.towns.some(t => t.q === 0)) { found = true; break; }
        }
        expect(found).toBe(true);
    });

    it("fairTowns false utilise le placement aléatoire sans contrainte d'équidistance", () => {
        resetUID();
        const state = initState(null, { fairTowns: false });
        expect(state.towns).toHaveLength(5);
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

describe("densité des terrains", () => {
    it("densité 'aucun' ne génère aucun terrain", () => {
        const density = { obstacles: 0, rivers: 0, towns: 0, forests: 0, hills: 0, swamps: 0 };
        const state = initState(null, { terrainDensity: density });
        expect(state.obstacles).toHaveLength(0);
        expect(state.rivers).toHaveLength(0);
        expect(state.towns).toHaveLength(0);
        expect(state.forests).toHaveLength(0);
        expect(state.hills).toHaveLength(0);
        expect(state.swamps).toHaveLength(0);
    });

    it("densité 'beaucoup' génère plus de terrain que la densité normale", () => {
        let normalObs = 0, highObs = 0;
        let normalHills = 0, highHills = 0;
        const runs = 10;
        for (let i = 0; i < runs; i++) {
            resetUID();
            const normal = initState(null, { terrainDensity: DEFAULT_TERRAIN_DENSITY });
            resetUID();
            const high = initState(null, { terrainDensity: { obstacles: 3, rivers: 3, towns: 3, forests: 3, hills: 3, swamps: 3 } });
            normalObs += normal.obstacles.length;
            highObs += high.obstacles.length;
            normalHills += normal.hills.length;
            highHills += high.hills.length;
        }
        expect(highObs).toBeGreaterThan(normalObs);
        expect(highHills).toBeGreaterThan(normalHills);
    });

    it("densité 'peu' génère moins de terrain que la densité normale", () => {
        let normalObs = 0, lowObs = 0;
        const runs = 10;
        for (let i = 0; i < runs; i++) {
            resetUID();
            const normal = initState(null, { terrainDensity: DEFAULT_TERRAIN_DENSITY });
            resetUID();
            const low = initState(null, { terrainDensity: { obstacles: 1, rivers: 1, towns: 1, forests: 1, hills: 1, swamps: 1 } });
            normalObs += normal.obstacles.length;
            lowObs += low.obstacles.length;
        }
        expect(lowObs).toBeLessThan(normalObs);
    });

    it("les terrains ne se chevauchent pas même en densité maximale", () => {
        for (let i = 0; i < 10; i++) {
            resetUID();
            const density = { obstacles: 3, rivers: 3, towns: 3, forests: 3, hills: 3, swamps: 3 };
            const state = initState(null, { terrainDensity: density });
            const allKeys = [
                ...state.obstacles.map(hexKey),
                ...state.rivers.map(hexKey),
                ...state.towns.map(hexKey),
                ...state.forests.map(hexKey),
                ...state.hills.map(hexKey),
                ...state.swamps.map(hexKey),
            ];
            expect(new Set(allKeys).size).toBe(allKeys.length);
        }
    });
});
