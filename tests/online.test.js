import { describe, it, expect } from "vitest";
import { generateCode, normalizeCode, isValidCode, remapAnimationTimes, onlinePlayerNumber, isNotMyTurn, shouldApplyDamage, applyOnlineMessage, CODE_LENGTH } from "../src/online.js";

describe("codes de partie", () => {
    it("génère un code valide de la bonne longueur", () => {
        for (let i = 0; i < 50; i++) {
            const code = generateCode();
            expect(code).toHaveLength(CODE_LENGTH);
            expect(isValidCode(code)).toBe(true);
        }
    });

    it("normalise la saisie utilisateur (espaces, minuscules)", () => {
        expect(normalizeCode("  ab2c ")).toBe("AB2C");
        expect(normalizeCode("")).toBe("");
        expect(normalizeCode(null)).toBe("");
    });

    it("accepte un code normalisé saisi par l'utilisateur", () => {
        expect(isValidCode(normalizeCode(" ab2c "))).toBe(true);
    });

    it("rejette les codes invalides", () => {
        expect(isValidCode("ABC")).toBe(false);
        expect(isValidCode("ABCDE")).toBe(false);
        expect(isValidCode("AB0D")).toBe(false);
        expect(isValidCode("AB!D")).toBe(false);
        expect(isValidCode("")).toBe(false);
    });
});

describe("remapAnimationTimes", () => {
    it("ramène les timestamps d'animation à l'horloge locale", () => {
        const state = {
            units: [{ id: 0 }],
            dyingUnits: [{ hex: { q: 0, r: 0, s: 0 }, symbol: "⚔", player: 1, deathTime: 12345 }],
            hitEffects: [{ hex: { q: 1, r: -1, s: 0 }, damage: 2, time: 67890 }],
            attackEffects: [{ from: { q: 0, r: 0, s: 0 }, to: { q: 1, r: -1, s: 0 }, weaponType: "ranged", time: 11111 }],
        };
        const now = 999999;
        const remapped = remapAnimationTimes(state, now);
        expect(remapped.dyingUnits[0].deathTime).toBe(now);
        expect(remapped.hitEffects[0].time).toBe(now);
        expect(remapped.attackEffects[0].time).toBe(now);
        expect(remapped.dyingUnits[0].symbol).toBe("⚔");
        expect(remapped.hitEffects[0].damage).toBe(2);
        expect(remapped.attackEffects[0].weaponType).toBe("ranged");
        expect(remapped.units).toEqual(state.units);
    });

    it("tolère un état sans animations", () => {
        const remapped = remapAnimationTimes({ units: [] });
        expect(remapped.dyingUnits).toEqual([]);
        expect(remapped.hitEffects).toEqual([]);
        expect(remapped.attackEffects).toEqual([]);
    });
});

describe("rôles en ligne", () => {
    it("l'hôte est le joueur 1, l'invité le joueur 2", () => {
        expect(onlinePlayerNumber({ role: "host", status: "connected" })).toBe(1);
        expect(onlinePlayerNumber({ role: "guest", status: "connected" })).toBe(2);
    });

    it("pas de joueur attribué hors ligne ou dans le menu", () => {
        expect(onlinePlayerNumber(null)).toBe(null);
        expect(onlinePlayerNumber({ role: null, status: "menu" })).toBe(null);
    });
});

describe("verrou de tour", () => {
    const online = { role: "host", status: "connected" };

    it("bloque les actions pendant le tour de l'adversaire", () => {
        expect(isNotMyTurn({ currentPlayer: 2 }, online, 1)).toBe(true);
    });

    it("autorise les actions pendant son propre tour", () => {
        expect(isNotMyTurn({ currentPlayer: 1 }, online, 1)).toBe(false);
    });

    it("ne verrouille jamais hors ligne", () => {
        expect(isNotMyTurn({ currentPlayer: 2 }, null, null)).toBe(false);
    });

    it("ne verrouille pas tant que la partie n'a pas commencé", () => {
        expect(isNotMyTurn(null, online, 1)).toBe(false);
    });
});

describe("application des dégâts", () => {
    const anim = { attacker: { player: 1 }, defender: { player: 2 } };

    it("seul l'attaquant applique les dégâts en ligne", () => {
        const online = { role: "host", status: "connected" };
        expect(shouldApplyDamage(anim, online, 1)).toBe(true);
        expect(shouldApplyDamage(anim, online, 2)).toBe(false);
    });

    it("toujours appliqués hors ligne", () => {
        expect(shouldApplyDamage(anim, null, null)).toBe(true);
    });
});

describe("protocole de messages", () => {
    const now = 555;

    it("army : met à jour la sélection d'armée de l'adversaire", () => {
        const effects = applyOnlineMessage({ type: "army", player: 2, selections: ["infantry", "tank"] }, now);
        expect(effects).toEqual({ armySelection: { player: 2, selections: ["infantry", "tank"] } });
    });

    it("start : applique l'état initial et quitte la phase d'armée", () => {
        const effects = applyOnlineMessage({ type: "start", state: { units: [], currentPlayer: 1 } }, now);
        expect(effects.startGame).toBe(true);
        expect(effects.state.currentPlayer).toBe(1);
    });

    it("state : remplace l'état en remappant les animations sur l'horloge locale", () => {
        const state = { units: [], dyingUnits: [{ deathTime: 1 }], hitEffects: [{ time: 2 }] };
        const effects = applyOnlineMessage({ type: "state", state }, now);
        expect(effects.state.dyingUnits[0].deathTime).toBe(now);
        expect(effects.state.hitEffects[0].time).toBe(now);
        expect(effects.startGame).toBeUndefined();
        expect(effects.diceAnim).toBeUndefined();
    });

    it("combat : applique l'état pré-dégâts et déclenche l'animation de dés", () => {
        const anim = { attacker: { player: 2 }, rolls: [4, 6] };
        const effects = applyOnlineMessage({ type: "combat", state: { units: [] }, anim }, now);
        expect(effects.diceAnim).toEqual(anim);
        expect(effects.state.units).toEqual([]);
    });

    it("ignore les messages inconnus", () => {
        expect(applyOnlineMessage({ type: "chat", text: "gg" }, now)).toBe(null);
    });
});
