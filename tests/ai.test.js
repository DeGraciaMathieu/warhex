import { describe, it, expect, beforeEach } from "vitest";
import { hexKey } from "../src/hex.js";
import { createUnit, resetUID } from "../src/units.js";
import { handleClick, computeEndTurn } from "../src/game.js";
import { computeAIAction } from "../src/ai.js";

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
