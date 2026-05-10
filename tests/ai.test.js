import { describe, it, expect, beforeEach } from "vitest";
import { hexKey } from "../src/hex.js";
import { createUnit, resetUID } from "../src/units.js";
import { handleClick, computeEndTurn } from "../src/game.js";
import { computeAIAction, pickBestUnit, pickMoveTarget, pickTarget } from "../src/ai.js";

beforeEach(() => resetUID());

function makeState(overrides = {}) {
    const u1 = createUnit("warrior", 1, { q: -2, r: 0, s: 2 });
    const u2 = createUnit("warrior", 2, { q: 2, r: 0, s: -2 });
    return {
        units: [u1, u2],
        obstacles: [],
        rivers: [],
        towns: [],
        forests: [],
        hills: [],
        swamps: [],
        currentPlayer: 2,
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
        activationsUsed: 0,
        activatedUnitIds: [],
        autoEndTurn: false,
        ...overrides,
    };
}

describe("IA basique", () => {
    it("sélectionne une unité du joueur 2 en phase select", () => {
        const state = makeState();
        const action = computeAIAction(state);
        expect(action.type).toBe("click");
        const unit = state.units.find(u => u.player === 2 && hexKey(u.hex) === hexKey(action.hex));
        expect(unit).toBeDefined();
    });

    it("se déplace vers l'ennemi le plus proche", () => {
        const state = makeState();
        const s1 = handleClick(state, state.units[1].hex);
        const action = computeAIAction(s1);
        expect(action.type).toBe("click");
        expect(action.hex).toBeDefined();
    });

    it("choisit une arme quand en phase weapon_select", () => {
        const u1 = createUnit("warrior", 1, { q: 1, r: 0, s: -1 });
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({
            units: [u1, u2],
            phase: "weapon_select",
            selectedUnit: u2,
            pendingAttack: { attacker: u2, target: u1 },
        });
        const action = computeAIAction(state);
        expect(action.type).toBe("weapon");
        expect(action.weapon).toBeDefined();
        expect(action.weapon.id).toBeDefined();
    });

    it("fait endTurn quand aucune unité disponible", () => {
        const u1 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const u2 = createUnit("warrior", 2, { q: 3, r: 0, s: -3 });
        u2.hasMoved = true;
        u2.hasAttacked = true;
        const state = makeState({ units: [u1, u2] });
        const action = computeAIAction(state);
        expect(action.type).toBe("endTurn");
    });

    it("attaque un ennemi à portée plutôt que de se déplacer", () => {
        const u1 = createUnit("warrior", 1, { q: 1, r: 0, s: -1 });
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({ units: [u1, u2] });
        const s1 = handleClick(state, u2.hex);
        expect(s1.validTargets.length).toBeGreaterThan(0);
        const action = computeAIAction(s1);
        expect(action.type).toBe("click");
        expect(hexKey(action.hex)).toBe(hexKey(u1.hex));
    });

    it("cible l'ennemi avec le moins de PV", () => {
        const u1 = createUnit("warrior", 1, { q: 1, r: 0, s: -1 });
        const u1b = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        u1b.currentWounds = 1;
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({ units: [u1, u1b, u2] });
        const s1 = handleClick(state, u2.hex);
        const action = computeAIAction(s1);
        expect(action.type).toBe("click");
        expect(hexKey(action.hex)).toBe(hexKey(u1b.hex));
    });

    it("retourne null si la partie est en phase resolving", () => {
        const state = makeState({ phase: "resolving" });
        const action = computeAIAction(state);
        expect(action).toBeNull();
    });
});

describe("IA — double activation", () => {
    it("l'IA sélectionne une 2e unité après la 1ère activation", () => {
        const u1 = createUnit("warrior", 1, { q: -4, r: 0, s: 4 });
        const u2a = createUnit("warrior", 2, { q: 2, r: 0, s: -2 });
        const u2b = createUnit("warrior", 2, { q: 3, r: 0, s: -3 });
        // Simuler la 1ère activation terminée : u2a a déjà bougé
        u2a.hasMoved = true;
        u2a.hasAttacked = true;
        const state = makeState({
            units: [u1, u2a, u2b],
            activationsUsed: 1,
            activatedUnitIds: [u2a.id],
        });
        const action = computeAIAction(state);
        expect(action.type).toBe("click");
        expect(hexKey(action.hex)).toBe(hexKey(u2b.hex));
    });

    it("l'IA fait endTurn quand les 2 unités ont déjà agi", () => {
        const u1 = createUnit("warrior", 1, { q: -4, r: 0, s: 4 });
        const u2a = createUnit("warrior", 2, { q: 2, r: 0, s: -2 });
        const u2b = createUnit("warrior", 2, { q: 3, r: 0, s: -3 });
        u2a.hasMoved = true;
        u2a.hasAttacked = true;
        u2b.hasMoved = true;
        u2b.hasAttacked = true;
        const state = makeState({
            units: [u1, u2a, u2b],
            activationsUsed: 2,
            activatedUnitIds: [u2a.id, u2b.id],
        });
        const action = computeAIAction(state);
        expect(action.type).toBe("endTurn");
    });
});

describe("IA — contrôle des villes", () => {
    it("se déplace vers une ville vide plutôt que vers l'ennemi", () => {
        const u1 = createUnit("warrior", 1, { q: -4, r: 0, s: 4 });
        const u2 = createUnit("warrior", 2, { q: 2, r: 0, s: -2 });
        const town = { q: 0, r: 0, s: 0 };
        const state = makeState({ units: [u1, u2], towns: [town] });
        const dest = pickMoveTarget(u2, state);
        const distToTown = Math.abs(dest.q - town.q) + Math.abs(dest.r - town.r) + Math.abs(dest.s - town.s);
        const origDistToTown = Math.abs(u2.hex.q - town.q) + Math.abs(u2.hex.r - town.r) + Math.abs(u2.hex.s - town.s);
        expect(distToTown).toBeLessThan(origDistToTown);
    });

    it("capture une ville vide atteignable directement", () => {
        const u1 = createUnit("warrior", 1, { q: -4, r: 0, s: 4 });
        const u2 = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        const town = { q: 0, r: 0, s: 0 };
        const state = makeState({ units: [u1, u2], towns: [town] });
        const dest = pickMoveTarget(u2, state);
        expect(hexKey(dest)).toBe(hexKey(town));
    });

    it("priorise l'attaque d'un ennemi sur une ville", () => {
        const u1OnTown = createUnit("warrior", 1, { q: 1, r: 0, s: -1 });
        const u1Far = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        u1Far.currentWounds = 1;
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const town = { q: 1, r: 0, s: -1 };
        const state = makeState({ units: [u1OnTown, u1Far, u2], towns: [town] });
        const target = pickTarget(u2, state);
        expect(hexKey(target.hex)).toBe(hexKey(u1OnTown.hex));
    });

    it("sélectionne en priorité une unité qui peut attaquer un ennemi sur une ville", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const u2a = createUnit("warrior", 2, { q: 3, r: 0, s: -3 });
        const u2b = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        const town = { q: 0, r: 0, s: 0 };
        const state = makeState({ units: [u1, u2a, u2b], towns: [town] });
        const best = pickBestUnit(state);
        expect(best.id).toBe(u2b.id);
    });

    it("l'IA choisit l'arme avec le meilleur output de dégâts", () => {
        const u1 = createUnit("warrior", 1, { q: 1, r: 0, s: -1 });
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({
            units: [u1, u2],
            phase: "weapon_select",
            selectedUnit: u2,
            pendingAttack: { attacker: u2, target: u1 },
        });
        const action = computeAIAction(state);
        expect(action.type).toBe("weapon");
        // Sword (3 attacks × 1 damage = 3) > Rifle (2 attacks × 1 damage = 2)
        expect(action.weapon.id).toBe("sword");
    });

    it("une unité sur une ville possédée reste si pas d'ennemi ni de ville à capturer", () => {
        const town = { q: 0, r: 0, s: 0 };
        const u2 = createUnit("warrior", 2, town);
        const state = makeState({ units: [u2], towns: [town], townOwnership: { [hexKey(town)]: 2 } });
        const dest = pickMoveTarget(u2, state);
        expect(dest).toBeNull();
    });

    it("une unité sur une ville possédée la quitte pour aller engager un ennemi", () => {
        const u1 = createUnit("warrior", 1, { q: -4, r: 0, s: 4 });
        const town = { q: 0, r: 0, s: 0 };
        const u2 = createUnit("warrior", 2, town);
        const state = makeState({ units: [u1, u2], towns: [town], townOwnership: { [hexKey(town)]: 2 } });
        const dest = pickMoveTarget(u2, state);
        expect(dest).not.toBeNull();
    });

    it("une unité sur une ville possédée la quitte pour capturer une ville prioritaire", () => {
        const town1 = { q: 0, r: 0, s: 0 };
        const town2 = { q: 2, r: -2, s: 0 };
        const u2 = createUnit("warrior", 2, town1);
        const state = makeState({ units: [u2], towns: [town1, town2], townOwnership: { [hexKey(town1)]: 2 } });
        const dest = pickMoveTarget(u2, state);
        expect(dest).not.toBeNull();
    });

    it("une unité sur une ville non possédée peut la quitter pour engager un ennemi", () => {
        const u1 = createUnit("warrior", 1, { q: -4, r: 0, s: 4 });
        const town = { q: 0, r: 0, s: 0 };
        const u2 = createUnit("warrior", 2, town);
        const state = makeState({ units: [u1, u2], towns: [town] });
        const dest = pickMoveTarget(u2, state);
        expect(dest).not.toBeNull();
    });

    it("se dirige vers un ennemi sur une ville quand pas de ville vide", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const u2 = createUnit("warrior", 2, { q: 4, r: 0, s: -4 });
        const town = { q: 0, r: 0, s: 0 };
        const state = makeState({ units: [u1, u2], towns: [town] });
        const dest = pickMoveTarget(u2, state);
        expect(dest).toBeDefined();
        const distBefore = Math.max(Math.abs(u2.hex.q - u1.hex.q), Math.abs(u2.hex.r - u1.hex.r), Math.abs(u2.hex.s - u1.hex.s));
        const distAfter = Math.max(Math.abs(dest.q - u1.hex.q), Math.abs(dest.r - u1.hex.r), Math.abs(dest.s - u1.hex.s));
        expect(distAfter).toBeLessThan(distBefore);
    });
});

describe("IA — villes possédées vs menacées", () => {
    it("ignore une ville possédée non menacée", () => {
        const u1 = createUnit("warrior", 1, { q: -6, r: 0, s: 6 });
        const u2 = createUnit("warrior", 2, { q: 2, r: 0, s: -2 });
        const town = { q: 0, r: 0, s: 0 };
        const state = makeState({
            units: [u1, u2],
            towns: [town],
            townOwnership: { [hexKey(town)]: 2 },
        });
        const dest = pickMoveTarget(u2, state);
        // L'ennemi est trop loin pour menacer la ville, l'IA ne devrait pas s'y diriger
        if (dest) {
            const distToTown = Math.max(Math.abs(dest.q - town.q), Math.abs(dest.r - town.r), Math.abs(dest.s - town.s));
            const distToEnemy = Math.max(Math.abs(dest.q - u1.hex.q), Math.abs(dest.r - u1.hex.r), Math.abs(dest.s - u1.hex.s));
            // Devrait se diriger vers l'ennemi, pas vers la ville
            const origDistToEnemy = Math.max(Math.abs(u2.hex.q - u1.hex.q), Math.abs(u2.hex.r - u1.hex.r), Math.abs(u2.hex.s - u1.hex.s));
            expect(distToEnemy).toBeLessThan(origDistToEnemy);
        }
    });

    it("se dirige vers une ville possédée menacée par un ennemi", () => {
        const town = { q: 0, r: 0, s: 0 };
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const u2 = createUnit("warrior", 2, { q: 3, r: 0, s: -3 });
        const state = makeState({
            units: [u1, u2],
            towns: [town],
            townOwnership: { [hexKey(town)]: 2 },
        });
        const dest = pickMoveTarget(u2, state);
        expect(dest).toBeDefined();
        const distBefore = Math.max(Math.abs(u2.hex.q - town.q), Math.abs(u2.hex.r - town.r), Math.abs(u2.hex.s - town.s));
        const distAfter = Math.max(Math.abs(dest.q - town.q), Math.abs(dest.r - town.r), Math.abs(dest.s - town.s));
        expect(distAfter).toBeLessThan(distBefore);
    });

    it("priorise une ville non possédée sur une ville possédée non menacée", () => {
        const ownedTown = { q: -1, r: 0, s: 1 };
        const freeTown = { q: 1, r: 0, s: -1 };
        const u1 = createUnit("warrior", 1, { q: -6, r: 0, s: 6 });
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({
            units: [u1, u2],
            towns: [ownedTown, freeTown],
            townOwnership: { [hexKey(ownedTown)]: 2 },
        });
        const dest = pickMoveTarget(u2, state);
        expect(hexKey(dest)).toBe(hexKey(freeTown));
    });
});

describe("IA — capture de ville prioritaire sur attaque", () => {
    it("préfère capturer une ville atteignable plutôt qu'attaquer un ennemi à portée", () => {
        const town = { q: 1, r: 0, s: -1 };
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({
            units: [u1, u2],
            towns: [town],
            selectedUnit: u2,
            phase: "move",
        });
        const action = computeAIAction(state);
        // L'IA devrait se déplacer vers la ville, pas attaquer l'ennemi adjacent
        expect(action.type).toBe("click");
        expect(hexKey(action.hex)).toBe(hexKey(town));
    });

    it("attaque si aucune ville prioritaire n'est atteignable", () => {
        const town = { q: 5, r: 0, s: -5 };
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({
            units: [u1, u2],
            towns: [town],
            selectedUnit: u2,
            phase: "move",
        });
        const action = computeAIAction(state);
        // La ville est trop loin, l'IA devrait attaquer l'ennemi à portée
        expect(action.type).toBe("click");
        expect(hexKey(action.hex)).toBe(hexKey(u1.hex));
    });
});

describe("IA — sélection d'unité sans ville prioritaire", () => {
    it("préfère l'unité la plus proche d'un ennemi quand aucune ville prioritaire", () => {
        const u1 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const u2a = createUnit("warrior", 2, { q: 4, r: 0, s: -4 });
        const u2b = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        const state = makeState({ units: [u1, u2a, u2b] });
        const best = pickBestUnit(state);
        expect(best.id).toBe(u2b.id);
    });


});

describe("IA — mouvement sur villes prioritaires", () => {
    it("avec plusieurs villes prioritaires, se dirige vers la plus proche", () => {
        const town1 = { q: -3, r: 0, s: 3 };
        const town2 = { q: 1, r: 0, s: -1 };
        const u1 = createUnit("warrior", 1, { q: -5, r: 0, s: 5 });
        const u2 = createUnit("warrior", 2, { q: 2, r: 0, s: -2 });
        const state = makeState({ units: [u1, u2], towns: [town1, town2] });
        const dest = pickMoveTarget(u2, state);
        expect(hexKey(dest)).toBe(hexKey(town2));
    });
});

describe("IA — sélection de cible", () => {
    it("cible l'ennemi avec le moins de PV quand aucun n'est sur une ville", () => {
        const u1a = createUnit("warrior", 1, { q: 1, r: -1, s: 0 });
        const u1b = createUnit("warrior", 1, { q: -1, r: 1, s: 0 });
        u1b.currentWounds = 1;
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({ units: [u1a, u1b, u2] });
        const target = pickTarget(u2, state);
        expect(target.id).toBe(u1b.id);
    });

    it("entre deux ennemis sur des villes, cible celui avec le moins de PV", () => {
        const town1 = { q: 1, r: -1, s: 0 };
        const town2 = { q: -1, r: 1, s: 0 };
        const u1a = createUnit("warrior", 1, town1);
        const u1b = createUnit("warrior", 1, town2);
        u1b.currentWounds = 1;
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({ units: [u1a, u1b, u2], towns: [town1, town2] });
        const target = pickTarget(u2, state);
        expect(target.id).toBe(u1b.id);
    });
});

describe("IA — annulation d'arme", () => {
    it("annule si aucune arme n'est utilisable à cette portée", () => {
        const u1 = createUnit("warrior", 1, { q: 4, r: -4, s: 0 });
        const u2 = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const state = makeState({
            units: [u1, u2],
            phase: "weapon_select",
            selectedUnit: u2,
            pendingAttack: { attacker: u2, target: u1 },
        });
        const action = computeAIAction(state);
        expect(action.type).toBe("cancel");
    });
});

describe("IA et marais", () => {
    it("une unité à 1 PV n'entre pas dans un marais", () => {
        const swamp = { q: 1, r: 0, s: -1 };
        const enemy = createUnit("warrior", 1, { q: 3, r: 0, s: -3 });
        const unit = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        unit.currentWounds = 1;
        const state = makeState({ units: [enemy, unit], swamps: [swamp] });
        const move = pickMoveTarget(unit, state);
        if (move) {
            expect(hexKey(move)).not.toBe(hexKey(swamp));
        }
    });

    it("une unité avec plus de 1 PV peut entrer dans un marais", () => {
        const swamp = { q: 1, r: 0, s: -1 };
        const enemy = createUnit("warrior", 1, { q: 2, r: 0, s: -2 });
        const unit = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        unit.currentWounds = 3;
        const state = makeState({ units: [enemy, unit], swamps: [swamp] });
        const move = pickMoveTarget(unit, state);
        expect(move).not.toBeNull();
    });
});
