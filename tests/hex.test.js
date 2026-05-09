import { describe, it, expect } from "vitest";
import { hexDistance, hexKey, hexToPixel, pixelToHex, isValidHex, hexNeighbors, hasLineOfSight } from "../src/hex.js";

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

    it("un hex a exactement 6 voisins", () => {
        const hex = { q: 0, r: 0, s: 0 };
        expect(hexNeighbors(hex)).toHaveLength(6);
    });

    it("deux hexes adjacents sont toujours en ligne de vue", () => {
        const a = { q: 0, r: 0, s: 0 };
        const neighbors = hexNeighbors(a);
        const obstacleKeys = new Set([hexKey({ q: 3, r: -3, s: 0 })]);
        for (const n of neighbors) {
            expect(hasLineOfSight(a, n, obstacleKeys)).toBe(true);
        }
    });
});
