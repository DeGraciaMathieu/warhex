import { describe, it, expect, beforeEach } from "vitest";
import { createUnit, resetUID, computeTownControl, checkWinner } from "../src/units.js";
import { hexKey } from "../src/hex.js";

beforeEach(() => resetUID());

describe("système de points", () => {
    const town1 = { q: 0, r: 0, s: 0 };
    const town2 = { q: 3, r: -3, s: 0 };

    it("une ville possédée rapporte 1 point à son joueur", () => {
        const ownership = { [hexKey(town1)]: 1 };
        const control = computeTownControl(ownership);
        expect(control[1]).toBe(1);
        expect(control[2]).toBe(0);
    });

    it("chaque joueur marque pour les villes qu'il possède", () => {
        const ownership = { [hexKey(town1)]: 1, [hexKey(town2)]: 2 };
        const control = computeTownControl(ownership);
        expect(control[1]).toBe(1);
        expect(control[2]).toBe(1);
    });

    it("un joueur peut posséder plusieurs villes", () => {
        const ownership = { [hexKey(town1)]: 1, [hexKey(town2)]: 1 };
        const control = computeTownControl(ownership);
        expect(control[1]).toBe(2);
    });

    it("une ville sans propriétaire ne rapporte rien", () => {
        const control = computeTownControl({});
        expect(control[1]).toBe(0);
        expect(control[2]).toBe(0);
    });

    it("la partie ne se termine pas avant le tour 8", () => {
        expect(checkWinner({ 1: 5, 2: 0 }, 7)).toBeNull();
        expect(checkWinner({ 1: 5, 2: 0 }, 3)).toBeNull();
    });

    it("le joueur avec le plus de points gagne au tour 8", () => {
        expect(checkWinner({ 1: 7, 2: 3 }, 8)).toBe(1);
        expect(checkWinner({ 1: 2, 2: 6 }, 8)).toBe(2);
    });

    it("égalité de points au tour 8 donne un match nul", () => {
        expect(checkWinner({ 1: 4, 2: 4 }, 8)).toBe("draw");
    });

    it("la partie peut se terminer après le tour 8", () => {
        expect(checkWinner({ 1: 10, 2: 3 }, 9)).toBe(1);
        expect(checkWinner({ 1: 2, 2: 8 }, 8)).toBe(2);
    });
});
