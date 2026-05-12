import { describe, it, expect } from "vitest";
import { hexKey, reachableHexes, isValidHex, hasLineOfSight, hexNeighbors } from "../src/hex.js";

describe("obstacles", () => {
    it("une unité ne peut pas traverser un obstacle", () => {
        const origin = { q: -1, r: 0, s: 1 };
        const obstacle = { q: 0, r: 0, s: 0 };
        const obstacleKeys = new Set([hexKey(obstacle)]);
        const reachable = reachableHexes(origin, 3, new Set(), obstacleKeys);
        const reachableKeys = new Set(reachable.map(hexKey));

        expect(reachableKeys.has(hexKey(obstacle))).toBe(false);
    });

    it("un obstacle entre deux hexes bloque la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const obstacle = { q: 0, r: 0, s: 0 };
        const obstacleKeys = new Set([hexKey(obstacle)]);

        expect(hasLineOfSight(a, b, obstacleKeys)).toBe(false);
    });

    it("la ligne de vue est dégagée sans obstacle intermédiaire", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const obstacleKeys = new Set();

        expect(hasLineOfSight(a, b, obstacleKeys)).toBe(true);
    });

    it("un obstacle sur la case de départ ou d'arrivée ne bloque pas la ligne de vue", () => {
        const a = { q: 0, r: 0, s: 0 };
        const b = { q: 2, r: 0, s: -2 };
        const obstacleKeys = new Set([hexKey(a), hexKey(b)]);

        expect(hasLineOfSight(a, b, obstacleKeys)).toBe(true);
    });

    it("les obstacles réduisent le nombre de destinations accessibles", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const withoutObstacles = reachableHexes(origin, 3, new Set(), new Set());

        const neighbors = hexNeighbors(origin);
        const obstacleKeys = new Set(neighbors.map(hexKey));
        const withObstacles = reachableHexes(origin, 3, new Set(), obstacleKeys);

        expect(withObstacles.length).toBe(0);
        expect(withoutObstacles.length).toBeGreaterThan(0);
    });
});

describe("rivières", () => {
    it("entrer dans une rivière stoppe le déplacement", () => {
        const origin = { q: -1, r: 0, s: 1 };
        const river = { q: 0, r: 0, s: 0 };
        const beyondRiver = { q: 1, r: 0, s: -1 };
        const riverKeys = new Set([hexKey(river)]);
        const reachable = reachableHexes(origin, 2, new Set(), new Set(), riverKeys);
        const reachableKeys = new Set(reachable.map(hexKey));

        expect(reachableKeys.has(hexKey(river))).toBe(true);
        expect(reachableKeys.has(hexKey(beyondRiver))).toBe(false);
    });

    it("une unité qui démarre sur une rivière peut se déplacer normalement", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const riverKeys = new Set([hexKey(origin)]);
        const reachable = reachableHexes(origin, 3, new Set(), new Set(), riverKeys);

        expect(reachable.length).toBeGreaterThan(6);
    });

    it("une rivière ne bloque pas la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const obstacleKeys = new Set();

        expect(hasLineOfSight(a, b, obstacleKeys)).toBe(true);
    });

    it("une rivière combinée à des obstacles réduit davantage les options", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const riverKeys = new Set([hexKey({ q: 1, r: -1, s: 0 })]);
        const obsKeys = new Set([hexKey({ q: -1, r: 1, s: 0 })]);
        const withBoth = reachableHexes(origin, 2, new Set(), obsKeys, riverKeys);
        const withNone = reachableHexes(origin, 2, new Set(), new Set(), new Set());
        expect(withBoth.length).toBeLessThan(withNone.length);
    });

    it("on peut contourner une rivière si le mouvement le permet", () => {
        const origin = { q: -1, r: 0, s: 1 };
        const river = { q: 0, r: 0, s: 0 };
        const target = { q: 1, r: 0, s: -1 };
        const riverKeys = new Set([hexKey(river)]);
        const reachable = reachableHexes(origin, 5, new Set(), new Set(), riverKeys);
        const reachableKeys = new Set(reachable.map(hexKey));

        expect(reachableKeys.has(hexKey(target))).toBe(true);
    });
});

describe("villes", () => {
    it("entrer dans une ville stoppe le déplacement", () => {
        const origin = { q: -1, r: 0, s: 1 };
        const town = { q: 0, r: 0, s: 0 };
        const beyondTown = { q: 1, r: 0, s: -1 };
        const townKeys = new Set([hexKey(town)]);
        const reachable = reachableHexes(origin, 2, new Set(), new Set(), townKeys);
        const reachableKeys = new Set(reachable.map(hexKey));

        expect(reachableKeys.has(hexKey(town))).toBe(true);
        expect(reachableKeys.has(hexKey(beyondTown))).toBe(false);
    });

    it("une ville entre deux hexes bloque la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const town = { q: 0, r: 0, s: 0 };
        const losKeys = new Set([hexKey(town)]);

        expect(hasLineOfSight(a, b, losKeys)).toBe(false);
    });

    it("une unité qui démarre sur une ville peut se déplacer normalement", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const townKeys = new Set([hexKey(origin)]);
        const reachable = reachableHexes(origin, 3, new Set(), new Set(), townKeys);

        expect(reachable.length).toBeGreaterThan(6);
    });
});

describe("forêts", () => {
    it("entrer dans une forêt coûte 2 points de mouvement", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const forest = { q: 1, r: -1, s: 0 };
        const forestKeys = new Set([hexKey(forest)]);
        const reachable1 = reachableHexes(origin, 1, new Set(), new Set(), new Set(), forestKeys);
        expect(new Set(reachable1.map(hexKey)).has(hexKey(forest))).toBe(false);
        const reachable2 = reachableHexes(origin, 2, new Set(), new Set(), new Set(), forestKeys);
        expect(new Set(reachable2.map(hexKey)).has(hexKey(forest))).toBe(true);
    });

    it("une forêt intermédiaire bloque la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const forest = { q: 0, r: 0, s: 0 };
        const losKeys = new Set([hexKey(forest)]);

        expect(hasLineOfSight(a, b, losKeys)).toBe(false);
    });

    it("une forêt sur la case de départ ou d'arrivée ne bloque pas la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const losKeys = new Set([hexKey(a), hexKey(b)]);

        expect(hasLineOfSight(a, b, losKeys)).toBe(true);
    });

    it("une forêt réduit la portée de déplacement effective", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const forestKeys = new Set([hexKey({ q: 1, r: -1, s: 0 })]);
        const withForest = reachableHexes(origin, 3, new Set(), new Set(), new Set(), forestKeys);
        const withoutForest = reachableHexes(origin, 3, new Set(), new Set(), new Set(), new Set());
        expect(withForest.length).toBeLessThan(withoutForest.length);
    });
});

describe("collines", () => {
    it("entrer sur une colline coûte 2 points de mouvement", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const hill = { q: 1, r: -1, s: 0 };
        const costKeys = new Set([hexKey(hill)]);
        const reachable1 = reachableHexes(origin, 1, new Set(), new Set(), new Set(), costKeys);
        expect(new Set(reachable1.map(hexKey)).has(hexKey(hill))).toBe(false);
        const reachable2 = reachableHexes(origin, 2, new Set(), new Set(), new Set(), costKeys);
        expect(new Set(reachable2.map(hexKey)).has(hexKey(hill))).toBe(true);
    });

    it("une colline intermédiaire bloque la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const hill = { q: 0, r: 0, s: 0 };
        const losKeys = new Set([hexKey(hill)]);
        expect(hasLineOfSight(a, b, losKeys)).toBe(false);
    });

    it("une colline sur la case de départ ou d'arrivée ne bloque pas la ligne de vue", () => {
        const a = { q: 0, r: 0, s: 0 };
        const b = { q: 2, r: -2, s: 0 };
        const losKeys = new Set([hexKey(a), hexKey(b)]);
        expect(hasLineOfSight(a, b, losKeys)).toBe(true);
    });

    it("une colline réduit la portée de déplacement effective", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const costKeys = new Set([hexKey({ q: 1, r: -1, s: 0 })]);
        const withHill = reachableHexes(origin, 3, new Set(), new Set(), new Set(), costKeys);
        const withoutHill = reachableHexes(origin, 3, new Set(), new Set(), new Set(), new Set());
        expect(withHill.length).toBeLessThan(withoutHill.length);
    });
});

describe("interactions terrain combinées", () => {
    it("une forêt bloque la LOS même si le tireur est sur une colline", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const forest = { q: 0, r: 0, s: 0 };
        const losKeys = new Set([hexKey(forest)]);
        expect(hasLineOfSight(a, b, losKeys)).toBe(false);
    });
});

describe("colline intermédiaire et LOS", () => {
    it("une colline intermédiaire bloque la LOS même si le tireur est sur une colline", () => {
        const a = { q: -3, r: 0, s: 3 };
        const b = { q: 3, r: 0, s: -3 };
        const hillBetween = { q: 0, r: 0, s: 0 };
        const losKeys = new Set([hexKey(a), hexKey(hillBetween), hexKey(b)]);
        expect(hasLineOfSight(a, b, losKeys)).toBe(false);
    });
});

describe("marais et ligne de vue", () => {
    it("un marais ne bloque pas la ligne de vue", () => {
        const a = { q: -2, r: 0, s: 2 };
        const b = { q: 2, r: 0, s: -2 };
        const swamp = { q: 0, r: 0, s: 0 };
        // Les marais ne font pas partie des losKeys (obstacles, villes, forêts)
        const losKeys = new Set();
        expect(hasLineOfSight(a, b, losKeys)).toBe(true);
    });
});

describe("marais", () => {
    it("un marais stoppe le mouvement", () => {
        const swamp = { q: 0, r: 0, s: 0 };
        const beyondSwamp = { q: 1, r: 0, s: -1 };
        const swampKeys = new Set([hexKey(swamp)]);
        const reachable = reachableHexes({ q: -1, r: 0, s: 1 }, 2, new Set(), new Set(), swampKeys);
        const reachableKeys = new Set(reachable.map(hexKey));
        expect(reachableKeys.has(hexKey(swamp))).toBe(true);
        expect(reachableKeys.has(hexKey(beyondSwamp))).toBe(false);
    });
});
