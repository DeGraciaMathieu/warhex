import { describe, it, expect } from "vitest";
import { initState, resetUID } from "../src/units.js";
import { computeAIAction, DEFAULT_AI_WEIGHTS } from "../src/ai.js";
import { runGame, mirrorState, getAIAction } from "../harness/sim.js";

const STANDARD = ["warrior", "warrior", "knight", "sniper", "berserker"];

describe("harness de simulation", () => {
    it("joue une partie complète jusqu'à un vainqueur", () => {
        const { state, aborted } = runGame({
            armies: { 1: STANDARD, 2: STANDARD },
        });
        expect(aborted).toBe(false);
        expect(state.winner).not.toBeNull();
        expect([1, 2, "draw"]).toContain(state.winner);
        expect(state.round).toBeGreaterThanOrEqual(8);
    });

    it("l'adaptateur de perspective produit une action valide pour le joueur 1", () => {
        resetUID();
        const state = initState({ 1: STANDARD, 2: STANDARD });
        expect(state.currentPlayer).toBe(1);
        const action = getAIAction(state, { 1: DEFAULT_AI_WEIGHTS, 2: DEFAULT_AI_WEIGHTS });
        expect(action).not.toBeNull();
        // L'IA doit sélectionner une de ses propres unités (joueur 1), en
        // coordonnées absolues valides dans l'état réel.
        expect(action.type).toBe("click");
        const own = state.units.find(u => u.player === 1 && u.hex.q === action.hex.q && u.hex.r === action.hex.r);
        expect(own).toBeDefined();
    });

    it("mirrorState permute les labels de joueur sans toucher aux positions", () => {
        resetUID();
        const state = initState({ 1: STANDARD, 2: STANDARD });
        const m = mirrorState(state);
        expect(m.currentPlayer).toBe(2);
        for (let i = 0; i < state.units.length; i++) {
            expect(m.units[i].player).toBe(state.units[i].player === 1 ? 2 : 1);
            expect(m.units[i].hex).toEqual(state.units[i].hex);
        }
    });

    it("computeAIAction sans poids est identique aux poids par défaut explicites", () => {
        resetUID();
        const state = initState({ 1: STANDARD, 2: STANDARD });
        // Tour du joueur 2 (l'IA native joue le 2) pour comparer sans miroir.
        const p2State = { ...state, currentPlayer: 2 };
        const a = computeAIAction(p2State);
        const b = computeAIAction(p2State, DEFAULT_AI_WEIGHTS);
        expect(a).toEqual(b);
    });
});
