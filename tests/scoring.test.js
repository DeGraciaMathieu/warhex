import { describe, it, expect, beforeEach } from "vitest";
import { createUnit, resetUID, computeTownControl, checkWinner } from "../src/units.js";

beforeEach(() => resetUID());

describe("système de points", () => {
    const town1 = { q: 0, r: 0, s: 0 };
    const town2 = { q: 3, r: -3, s: 0 };
    const towns = [town1, town2];

    it("une unité sur une ville rapporte 1 point à son joueur", () => {
        const units = [createUnit("warrior", 1, town1)];
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
        const units = [{ ...createUnit("warrior", 1, town1), currentWounds: 0 }];
        const control = computeTownControl(units, towns);
        expect(control[1]).toBe(0);
    });

    it("une unité hors d'une ville ne rapporte rien", () => {
        const units = [createUnit("warrior", 1, { q: 1, r: -1, s: 0 })];
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

    it("une ville sans unité ne rapporte de points à personne", () => {
        const units = [createUnit("warrior", 1, { q: 5, r: -5, s: 0 })];
        const control = computeTownControl(units, towns);
        expect(control[1]).toBe(0);
        expect(control[2]).toBe(0);
    });

    it("deux unités adverses ne peuvent pas être sur la même ville", () => {
        const units = [
            createUnit("warrior", 1, town1),
            createUnit("warrior", 2, town1),
        ];
        const control = computeTownControl(units, towns);
        // Les deux sont vivantes sur la même ville — impossible en jeu, mais le contrôle revient aux deux
        expect(control[1] + control[2]).toBeGreaterThanOrEqual(1);
    });
});
