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
