import { describe, it, expect } from "vitest";
import { hexDistance, hexKey, hexToPixel, pixelToHex, isValidHex, hexNeighbors, hasLineOfSight, hexesInRange, pathDistance, findPath, reachableHexes } from "../src/hex.js";

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

    it("hexesInRange retourne tous les hexes dans le rayon donné sauf le centre", () => {
        const center = { q: 0, r: 0, s: 0 };
        const range1 = hexesInRange(center, 1);
        expect(range1).toHaveLength(6);
        for (const h of range1) {
            expect(hexDistance(center, h)).toBe(1);
        }
        expect(range1.every(h => hexKey(h) !== hexKey(center))).toBe(true);
    });

    it("hexesInRange exclut les hexes hors grille", () => {
        const edge = { q: 5, r: -5, s: 0 };
        const result = hexesInRange(edge, 2);
        for (const h of result) {
            expect(isValidHex(h)).toBe(true);
        }
        expect(result.length).toBeLessThan(18);
    });

});

describe("pathDistance", () => {
    it("la distance entre un hex et lui-même est 0", () => {
        const hex = { q: 0, r: 0, s: 0 };
        expect(pathDistance(hex, hex)).toBe(0);
    });

    it("la distance entre deux hexes adjacents sans obstacle est 1", () => {
        const a = { q: 0, r: 0, s: 0 };
        const b = { q: 1, r: -1, s: 0 };
        expect(pathDistance(a, b)).toBe(1);
    });

    it("contourne un obstacle entre deux hexes", () => {
        const a = { q: 0, r: 0, s: 0 };
        const b = { q: 2, r: 0, s: -2 };
        const obstacle = { q: 1, r: 0, s: -1 };
        const obsKeys = new Set([hexKey(obstacle)]);
        const dist = pathDistance(a, b, obsKeys);
        // En ligne droite = 2, mais l'obstacle force un détour = 3
        expect(dist).toBeGreaterThan(hexDistance(a, b));
    });

    it("retourne Infinity quand le chemin est totalement bloqué", () => {
        // Entourer la cible d'obstacles
        const target = { q: 0, r: 0, s: 0 };
        const neighbors = hexNeighbors(target);
        const obsKeys = new Set(neighbors.map(hexKey));
        const start = { q: 2, r: 0, s: -2 };
        expect(pathDistance(start, target, obsKeys)).toBe(Infinity);
    });

    it("prend en compte le coût double des terrains costKeys", () => {
        const a = { q: 0, r: 0, s: 0 };
        const b = { q: 2, r: 0, s: -2 };
        const forest = { q: 1, r: 0, s: -1 };
        const costKeys = new Set([hexKey(forest)]);
        // Sans coût = 2, avec forêt au milieu = 3
        expect(pathDistance(a, b, new Set(), costKeys)).toBe(3);
    });
});

describe("findPath", () => {
    const empty = new Set();

    it("renvoie [start] quand l'origine est la cible", () => {
        const hex = { q: 0, r: 0, s: 0 };
        expect(findPath(hex, hex, 5, empty)).toEqual([hex]);
    });

    it("renvoie une suite contiguë de cases de l'origine à la cible", () => {
        const start = { q: 0, r: 0, s: 0 };
        const target = { q: 3, r: 0, s: -3 };
        const path = findPath(start, target, 5, empty);
        expect(hexKey(path[0])).toBe(hexKey(start));
        expect(hexKey(path[path.length - 1])).toBe(hexKey(target));
        for (let i = 1; i < path.length; i++) {
            expect(hexDistance(path[i - 1], path[i])).toBe(1);
        }
    });

    it("ne traverse jamais un obstacle et contourne", () => {
        const start = { q: 0, r: 0, s: 0 };
        const target = { q: 2, r: 0, s: -2 };
        const obstacle = { q: 1, r: 0, s: -1 };
        const obsKeys = new Set([hexKey(obstacle)]);
        const path = findPath(start, target, 5, empty, obsKeys);
        expect(path.some(h => hexKey(h) === hexKey(obstacle))).toBe(false);
        expect(path.length).toBeGreaterThan(hexDistance(start, target) + 1);
    });

    it("renvoie [] quand la cible n'est pas atteignable dans le mouvement", () => {
        const start = { q: 0, r: 0, s: 0 };
        const target = { q: 4, r: 0, s: -4 };
        expect(findPath(start, target, 2, empty)).toEqual([]);
    });

    it("respecte le coût double des terrains (longueur ≤ mouvement en coût)", () => {
        const start = { q: 0, r: 0, s: 0 };
        const target = { q: 2, r: 0, s: -2 };
        const forest = { q: 1, r: 0, s: -1 };
        const costKeys = new Set([hexKey(forest)]);
        // Coût direct = 1 (forêt=2) + 1 = 3, contournement = 3 aussi.
        const path = findPath(start, target, 3, empty, empty, empty, costKeys);
        expect(hexKey(path[path.length - 1])).toBe(hexKey(target));
        // Au-delà du budget, inatteignable.
        expect(findPath(start, target, 2, empty, empty, empty, costKeys)).toEqual([]);
    });

    it("n'atteint que des cases que reachableHexes considère atteignables", () => {
        const start = { q: 0, r: 0, s: 0 };
        const movement = 3;
        const obsKeys = new Set([hexKey({ q: 1, r: 0, s: -1 })]);
        const reachable = new Set(reachableHexes(start, movement, empty, obsKeys).map(hexKey));
        const target = { q: 2, r: -1, s: -1 };
        if (reachable.has(hexKey(target))) {
            const path = findPath(start, target, movement, empty, obsKeys);
            expect(hexKey(path[path.length - 1])).toBe(hexKey(target));
        }
    });
});

describe("voisins, portée et ligne de vue", () => {
    it("deux hexes adjacents sont toujours en ligne de vue", () => {
        const a = { q: 0, r: 0, s: 0 };
        const neighbors = hexNeighbors(a);
        const obstacleKeys = new Set([hexKey({ q: 3, r: -3, s: 0 })]);
        for (const n of neighbors) {
            expect(hasLineOfSight(a, n, obstacleKeys)).toBe(true);
        }
    });
});
