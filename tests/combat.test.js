import { describe, it, expect, beforeEach } from "vitest";
import { resolveAttack } from "../src/combat.js";
import { createUnit, resetUID } from "../src/units.js";

beforeEach(() => resetUID());

describe("combat", () => {
    it("une attaque produit toujours un résultat avec des dégâts >= 0", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[0];

        for (let i = 0; i < 50; i++) {
            const result = resolveAttack(attacker, weapon, target);
            expect(result.damage).toBeGreaterThanOrEqual(0);
            expect(result.log.length).toBeGreaterThanOrEqual(2);
        }
    });

    it("les dégâts ne dépassent jamais attaques × damage", () => {
        const attacker = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 1, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[0];
        const maxDamage = weapon.attacks * weapon.damage;

        for (let i = 0; i < 100; i++) {
            const result = resolveAttack(attacker, weapon, target);
            expect(result.damage).toBeLessThanOrEqual(maxDamage);
        }
    });

    it("le log de combat suit la séquence To Hit → Save → Summary", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[1];

        let foundFullSequence = false;
        for (let i = 0; i < 200; i++) {
            const result = resolveAttack(attacker, weapon, target);
            const labels = result.log.map(e => e.label);

            expect(labels[0]).toContain("To Hit");
            expect(labels[labels.length - 1]).toContain("Dégâts infligés");

            if (result.log.length === 3) {
                foundFullSequence = true;
                expect(labels[1]).toContain("Sauvegarde");
            }
        }
        expect(foundFullSequence).toBe(true);
    });

    it("une arme avec PA rend la sauvegarde plus difficile", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const withPA = { id: "test", name: "Test", type: "melee", range: 1, attacks: 3, strength: 4, ap: -2, damage: 1 };
        const noPA = { id: "test", name: "Test", type: "melee", range: 1, attacks: 3, strength: 4, ap: 0, damage: 1 };

        let totalWithPA = 0, totalNoPA = 0;
        for (let i = 0; i < 1000; i++) {
            totalWithPA += resolveAttack(attacker, withPA, target).damage;
            totalNoPA += resolveAttack(attacker, noPA, target).damage;
        }
        expect(totalWithPA).toBeGreaterThan(totalNoPA);
    });

    it("un PA assez fort rend la sauvegarde impossible", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const bigAP = { id: "test", name: "Test", type: "melee", range: 1, attacks: 4, strength: 4, ap: -3, damage: 1 };

        let found = false;
        for (let i = 0; i < 100; i++) {
            const result = resolveAttack(attacker, bigAP, target);
            const saveEntry = result.log.find(e => e.isSave);
            if (saveEntry) {
                found = true;
                expect(saveEntry.label).toContain("impossible");
                expect(saveEntry.success).toBe(0);
            }
        }
        expect(found).toBe(true);
    });

    it("une arme avec plus d'attaques fait plus de dégâts en moyenne", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const manyAttacks = { id: "test", name: "Test", type: "melee", range: 1, attacks: 4, strength: 4, ap: 0, damage: 1 };
        const fewAttacks = { id: "test2", name: "Test2", type: "melee", range: 1, attacks: 1, strength: 4, ap: 0, damage: 1 };

        let totalMany = 0, totalFew = 0;
        for (let i = 0; i < 500; i++) {
            totalMany += resolveAttack(attacker, manyAttacks, target).damage;
            totalFew += resolveAttack(attacker, fewAttacks, target).damage;
        }
        expect(totalMany).toBeGreaterThan(totalFew);
    });

    it("le couvert de ville réduit les dégâts subis", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = { id: "test", name: "Test", type: "melee", range: 1, attacks: 4, strength: 4, ap: -1, damage: 1 };

        let totalNoCover = 0, totalCover = 0;
        for (let i = 0; i < 1000; i++) {
            totalNoCover += resolveAttack(attacker, weapon, target).damage;
            totalCover += resolveAttack(attacker, weapon, target, { coverBonus: 1 }).damage;
        }
        expect(totalNoCover).toBeGreaterThan(totalCover);
    });

    it("le défenseur lance toujours 3 dés de sauvegarde", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[1];

        for (let i = 0; i < 100; i++) {
            const result = resolveAttack(attacker, weapon, target);
            const saveEntry = result.log.find(e => e.isSave);
            if (saveEntry) {
                expect(saveEntry.rolls).toHaveLength(3);
            }
        }
    });
});

describe("compétences de combat", () => {
    it("une arme de mêlée utilise weaponSkill, une arme à distance utilise ballisticSkill", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const melee = attacker.weapons.find(w => w.type === "melee");
        const ranged = attacker.weapons.find(w => w.type === "ranged");

        for (let i = 0; i < 20; i++) {
            const result = resolveAttack(attacker, melee, target);
            expect(result.log[0].label).toContain(`${attacker.weaponSkill}+`);
        }
        for (let i = 0; i < 20; i++) {
            const result = resolveAttack(attacker, ranged, target);
            expect(result.log[0].label).toContain(`${attacker.ballisticSkill}+`);
        }
    });

    it("si aucun dé ne touche, il n'y a pas de phase de sauvegarde", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons[0];

        let foundNoHits = false;
        for (let i = 0; i < 200; i++) {
            const result = resolveAttack(attacker, weapon, target);
            if (result.log[0].success === 0) {
                foundNoHits = true;
                expect(result.log.length).toBe(2);
                expect(result.damage).toBe(0);
            }
        }
        expect(foundNoHits).toBe(true);
    });
});
