import { describe, it, expect } from "vitest";
import { SETUP_STEPS, setupSteps, nextSetupStep, canAdvanceFromMode } from "../src/setup.js";

describe("setupSteps", () => {
    it("retourne la séquence complète hors-ligne", () => {
        expect(setupSteps(null)).toEqual(["mode", "terrain", "armies"]);
    });

    it("retourne la séquence complète pour l'hôte", () => {
        expect(setupSteps({ role: "host", status: "connected" })).toEqual(SETUP_STEPS);
    });

    it("retire l'étape Terrain pour le guest", () => {
        expect(setupSteps({ role: "guest", status: "connected" })).toEqual(["mode", "armies"]);
    });
});

describe("nextSetupStep", () => {
    it("avance dans l'ordre hors-ligne", () => {
        expect(nextSetupStep("mode", null)).toBe("terrain");
        expect(nextSetupStep("terrain", null)).toBe("armies");
    });

    it("le guest saute Terrain (Mode → Armées)", () => {
        const guest = { role: "guest", status: "connected" };
        expect(nextSetupStep("mode", guest)).toBe("armies");
    });

    it("reste à la dernière étape (Armées)", () => {
        expect(nextSetupStep("armies", null)).toBe("armies");
        expect(nextSetupStep("armies", { role: "guest" })).toBe("armies");
    });

    it("reste sur place pour une étape inconnue de la séquence", () => {
        expect(nextSetupStep("terrain", { role: "guest" })).toBe("terrain");
    });
});

describe("canAdvanceFromMode", () => {
    it("autorise toujours hors-ligne", () => {
        expect(canAdvanceFromMode(null)).toBe(true);
    });

    it("bloque tant que la connexion n'est pas établie", () => {
        expect(canAdvanceFromMode({ status: "menu" })).toBe(false);
        expect(canAdvanceFromMode({ status: "waiting" })).toBe(false);
        expect(canAdvanceFromMode({ status: "connecting" })).toBe(false);
    });

    it("autorise une fois connecté", () => {
        expect(canAdvanceFromMode({ status: "connected" })).toBe(true);
    });
});
