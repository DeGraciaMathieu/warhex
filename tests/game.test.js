import { describe, it, expect, beforeEach } from "vitest";
import { hexKey, reachableHexes, isValidHex } from "../src/hex.js";
import { createUnit, resetUID } from "../src/units.js";
import { handleClick, computeMove, computeAttack, computeWeaponSelect, applyDamage, computeEndTurn, computeDeselect } from "../src/game.js";

beforeEach(() => resetUID());

function makeState(overrides = {}) {
    const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
    const u2 = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
    return {
        units: [u1, u2],
        obstacles: [],
        rivers: [],
        towns: [],
        forests: [],
        hills: [],
        swamps: [],
        currentPlayer: 1,
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
        activationsUsed: 0,
        activatedUnitIds: [],
        autoEndTurn: false,
        ...overrides,
    };
}

describe("sélection et déplacement", () => {
    it("cliquer sur une unité alliée la sélectionne", () => {
        const s = makeState();
        const result = handleClick(s, { q: -1, r: 0, s: 1 });
        expect(result.selectedUnit).not.toBeNull();
        expect(result.selectedUnit.id).toBe(s.units[0].id);
        expect(result.validMoves.length).toBeGreaterThan(0);
    });

    it("on ne peut pas sélectionner une unité ennemie", () => {
        const s = makeState();
        const result = handleClick(s, { q: 1, r: 0, s: -1 });
        expect(result.selectedUnit).toBeNull();
    });

    it("on ne peut pas sélectionner une autre unité quand activeUnitId est défini", () => {
        createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const u2 = createUnit("warrior", 1, { q: -2, r: 1, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 2, r: -1, s: -1 });
        const s = makeState({ units: [u1, u2, enemy], activeUnitId: u1.id, selectedUnit: u1 });
        const result = handleClick(s, u2.hex);
        expect(result.selectedUnit.id).toBe(u1.id);
    });

    it("cliquer sur un hex de déplacement valide déplace l'unité", () => {
        const s = makeState();
        const selected = handleClick(s, { q: -1, r: 0, s: 1 });
        const moveTarget = selected.validMoves[0];
        const moved = handleClick(selected, moveTarget);
        expect(moved.selectedUnit.hex).toEqual(moveTarget);
        expect(moved.selectedUnit.hasMoved).toBe(true);
    });

    it("handleClick ne fait rien si la partie est gagnée", () => {
        const s = makeState({ winner: 1 });
        const result = handleClick(s, { q: -1, r: 0, s: 1 });
        expect(result).toEqual(s);
    });

    it("computeMove ne donne pas de mouvements si l'unité a déjà bougé", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        u1.hasMoved = true;
        const s = makeState({ units: [u1], selectedUnit: u1 });
        const result = computeMove(s);
        expect(result.validMoves).toHaveLength(0);
    });
});

describe("attaque et armes", () => {
    it("computeAttack ne donne pas de cibles si l'unité a déjà attaqué", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        u1.hasAttacked = true;
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [u1, enemy], selectedUnit: u1 });
        const result = computeAttack(s);
        expect(result).toEqual(s);
    });

    it("computeWeaponSelect annule si la cible est hors de portée", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const weapon = attacker.weapons.find(w => w.id === "rifle");
        const s = makeState({ units: [attacker, target], pendingAttack: { attacker, target } });
        const result = computeWeaponSelect(s, weapon);
        expect(result.anim).toBeNull();
        expect(result.state.phase).toBe("select");
    });

    it("computeWeaponSelect résout l'attaque si la cible est à portée", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons.find(w => w.id === "sword");
        const s = makeState({ units: [attacker, target], pendingAttack: { attacker, target } });
        const result = computeWeaponSelect(s, weapon);
        expect(result.anim).not.toBeNull();
        expect(result.state.phase).toBe("resolving");
        expect(result.anim.damage).toBeGreaterThanOrEqual(0);
    });

    it("applyDamage réduit les PV de la cible et marque l'attaquant comme ayant attaqué", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 1, weaponName: "Sword", log: [], isDead: false };
        const result = applyDamage(s, anim);
        const tgt = result.units.find(u => u.id === target.id);
        const atk = result.units.find(u => u.id === attacker.id);
        expect(tgt.currentWounds).toBe(target.currentWounds - 1);
        expect(atk.hasAttacked).toBe(true);
    });

    it("applyDamage ne descend pas les PV sous 0", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 99, weaponName: "Sword", log: [], isDead: true };
        const result = applyDamage(s, anim);
        const tgt = result.units.find(u => u.id === target.id);
        expect(tgt.currentWounds).toBe(0);
    });
});

describe("fin de tour", () => {
    it("computeEndTurn passe au joueur suivant et réinitialise les flags", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        u1.hasMoved = true;
        u1.hasAttacked = true;
        const s = makeState({ units: [u1], currentPlayer: 1 });
        const result = computeEndTurn(s);
        expect(result.currentPlayer).toBe(2);
        expect(result.units[0].hasMoved).toBe(false);
        expect(result.units[0].hasAttacked).toBe(false);
        expect(result.activeUnitId).toBeNull();
    });

    it("computeEndTurn marque les points des villes en fin de round", () => {
        const town = { q: 0, r: 0, s: 0 };
        const u1 = createUnit("warrior", 1, town);
        const s = makeState({ units: [u1], towns: [town], currentPlayer: 2 });
        const result = computeEndTurn(s);
        expect(result.scores[1]).toBe(1);
    });

    it("computeEndTurn ne fait rien si un gagnant existe déjà", () => {
        const s = makeState({ winner: 1 });
        const result = computeEndTurn(s);
        expect(result).toEqual(s);
    });

    it("computeEndTurn incrémente le round en fin de round", () => {
        const s = makeState({ currentPlayer: 2, round: 3 });
        const result = computeEndTurn(s);
        expect(result.round).toBe(4);
        expect(result.currentPlayer).toBe(1);
    });

    it("computeEndTurn n'incrémente pas le round en milieu de round", () => {
        const s = makeState({ currentPlayer: 1, round: 3 });
        const result = computeEndTurn(s);
        expect(result.round).toBe(3);
        expect(result.currentPlayer).toBe(2);
    });
});

describe("ligne de vue en jeu", () => {
    it("une forêt intermédiaire empêche de cibler un ennemi", () => {
        const forest = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("sniper", 1, { q: -2, r: 0, s: 2 });
        const target = createUnit("warrior", 2, { q: 2, r: 0, s: -2 });
        const s = makeState({ units: [attacker, target], forests: [forest] });
        const selected = handleClick(s, attacker.hex);
        expect(selected.validTargets.some(t => t.id === target.id)).toBe(false);
    });

    it("on peut tirer depuis une forêt vers une cible visible", () => {
        const forest = { q: -2, r: 0, s: 2 };
        const attacker = createUnit("sniper", 1, forest);
        const target = createUnit("warrior", 2, { q: 0, r: 0, s: 0 });
        const s = makeState({ units: [attacker, target], forests: [forest] });
        const selected = handleClick(s, forest);
        expect(selected.validTargets.some(t => t.id === target.id)).toBe(true);
    });

    it("on peut tirer sur une cible dans une forêt", () => {
        const forest = { q: 1, r: -1, s: 0 };
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, forest);
        const s = makeState({ units: [attacker, target], forests: [forest] });
        const selected = handleClick(s, attacker.hex);
        expect(selected.validTargets.some(t => t.id === target.id)).toBe(true);
    });
});

describe("collines", () => {
    it("une unité sur une colline peut tirer plus loin avec une arme à distance", () => {
        const hill = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("warrior", 1, hill);
        const target = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [attacker, target], hills: [hill] });
        const selected = handleClick(s, hill);
        expect(selected.validTargets.some(t => t.id === target.id)).toBe(true);
    });

    it("sans colline, une arme de portée 2 ne peut pas atteindre distance 3", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const selected = handleClick(s, { q: 0, r: 0, s: 0 });
        expect(selected.validTargets.some(t => t.id === target.id)).toBe(false);
    });

    it("la colline ne donne pas de bonus de portée aux armes de mêlée", () => {
        const hill = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("knight", 1, hill);
        const target = createUnit("warrior", 2, { q: 2, r: -2, s: 0 });
        const s = makeState({ units: [attacker, target], hills: [hill] });
        const selected = handleClick(s, hill);
        expect(selected.validTargets.some(t => t.id === target.id)).toBe(false);
    });

    it("computeWeaponSelect accepte un tir à portée+1 depuis une colline", () => {
        const hill = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("warrior", 1, hill);
        const target = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const weapon = attacker.weapons.find(w => w.id === "rifle");
        const s = makeState({ units: [attacker, target], hills: [hill], pendingAttack: { attacker, target } });
        const result = computeWeaponSelect(s, weapon);
        expect(result.anim).not.toBeNull();
    });

    it("le flux complet sélection → cible → arme fonctionne depuis une colline à portée+1", () => {
        const hill = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("warrior", 1, hill);
        const target = createUnit("warrior", 2, { q: 3, r: -3, s: 0 }); // distance 3, rifle range 2
        const s = makeState({ units: [attacker, target], hills: [hill] });
        // Sélection : la cible apparaît
        const selected = handleClick(s, hill);
        expect(selected.validTargets.some(t => t.id === target.id)).toBe(true);
        // Clic sur la cible : passage en weapon_select
        const clicked = handleClick(selected, target.hex);
        expect(clicked.phase).toBe("weapon_select");
        // Choix de l'arme à distance : l'attaque se résout
        const rifle = attacker.weapons.find(w => w.id === "rifle");
        const result = computeWeaponSelect(clicked, rifle);
        expect(result.anim).not.toBeNull();
        expect(result.anim.weaponName).toBe("Rifle");
        expect(result.anim.damage).toBeGreaterThanOrEqual(0);
    });

    it("computeWeaponSelect refuse un tir melee depuis une colline au-delà de la portée", () => {
        const hill = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("warrior", 1, hill);
        const target = createUnit("warrior", 2, { q: 2, r: -2, s: 0 });
        const weapon = attacker.weapons.find(w => w.id === "sword");
        const s = makeState({ units: [attacker, target], hills: [hill], pendingAttack: { attacker, target } });
        const result = computeWeaponSelect(s, weapon);
        expect(result.anim).toBeNull();
    });
});

describe("marais", () => {
    it("entrer dans un marais inflige 1 dégât poison", () => {
        const swamp = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [attacker, enemy], swamps: [swamp] });
        const selected = handleClick(s, { q: -1, r: 0, s: 1 });
        const moved = handleClick(selected, swamp);
        const unit = moved.units.find(u => u.id === attacker.id);
        expect(unit.currentWounds).toBe(attacker.wounds - 1);
    });

    it("une unité tuée par le poison du marais termine le tour automatiquement", () => {
        const swamp = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("sniper", 1, { q: -1, r: 0, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [attacker, enemy], swamps: [swamp] });
        const selected = handleClick(s, { q: -1, r: 0, s: 1 });
        const moved = handleClick(selected, swamp);
        const dead = moved.units.find(u => u.id === attacker.id);
        expect(dead.currentWounds).toBe(0);
        expect(moved.autoEndTurn).toBe(true);
        expect(moved.selectedUnit).toBeNull();
    });
});

describe("double activation", () => {
    it("après une activation, le joueur peut sélectionner une autre unité", () => {
        const u1 = createUnit("warrior", 1, { q: -2, r: 0, s: 2 });
        const u2 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({ units: [u1, u2, enemy] });
        // Sélectionner et déplacer u1
        const selected = handleClick(s, u1.hex);
        const moveTarget = selected.validMoves[0];
        const moved = handleClick(selected, moveTarget);
        // u1 a terminé (pas de cibles), activation consommée
        expect(moved.activationsUsed).toBe(1);
        expect(moved.autoEndTurn).toBe(false);
        // On peut sélectionner u2
        const selected2 = handleClick(moved, u2.hex);
        expect(selected2.selectedUnit).not.toBeNull();
        expect(selected2.selectedUnit.id).toBe(u2.id);
    });

    it("on ne peut pas sélectionner une unité déjà activée ce tour", () => {
        const u1 = createUnit("warrior", 1, { q: -2, r: 0, s: 2 });
        const u2 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({ units: [u1, u2, enemy] });
        const selected = handleClick(s, u1.hex);
        const moved = handleClick(selected, selected.validMoves[0]);
        // Tenter de re-sélectionner u1
        const movedU1 = moved.units.find(u => u.id === u1.id);
        const retry = handleClick(moved, movedU1.hex);
        expect(retry.selectedUnit).toBeNull();
    });

    it("après 2 activations, autoEndTurn passe à true", () => {
        const u1 = createUnit("warrior", 1, { q: -2, r: 0, s: 2 });
        const u2 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({ units: [u1, u2, enemy] });
        // Activation 1
        const s1 = handleClick(s, u1.hex);
        const s2 = handleClick(s1, s1.validMoves[0]);
        expect(s2.activationsUsed).toBe(1);
        // Activation 2
        const s3 = handleClick(s2, u2.hex);
        const s4 = handleClick(s3, s3.validMoves[0]);
        expect(s4.activationsUsed).toBe(2);
        expect(s4.autoEndTurn).toBe(true);
    });

    it("computeEndTurn réinitialise les compteurs d'activation", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const s = makeState({ units: [u1], activationsUsed: 2, activatedUnitIds: [u1.id] });
        const result = computeEndTurn(s);
        expect(result.activationsUsed).toBe(0);
        expect(result.activatedUnitIds).toEqual([]);
    });

    it("computeDeselect consomme une activation si l'unité a agi", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const u2 = createUnit("warrior", 1, { q: -2, r: 0, s: 2 });
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        u1.hasMoved = true;
        const s = makeState({ units: [u1, u2, enemy], selectedUnit: u1, activeUnitId: u1.id });
        const result = computeDeselect(s);
        expect(result.activationsUsed).toBe(1);
        expect(result.activatedUnitIds).toContain(u1.id);
        expect(result.selectedUnit).toBeNull();
    });

    it("computeDeselect ne consomme pas d'activation si l'unité n'a pas agi", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 2, r: -2, s: 0 });
        const s = makeState({ units: [u1, enemy], selectedUnit: u1 });
        const result = computeDeselect(s);
        expect(result.activationsUsed).toBe(0);
        expect(result.selectedUnit).toBeNull();
    });

    it("une attaque consomme une activation", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const u2 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [u1, u2, enemy] });
        // Sélectionner u1, cliquer sur l'ennemi pour attaquer
        const selected = handleClick(s, u1.hex);
        const clicked = handleClick(selected, enemy.hex);
        expect(clicked.phase).toBe("weapon_select");
        // Choisir l'arme
        const weapon = u1.weapons.find(w => w.id === "sword");
        const result = computeWeaponSelect(clicked, weapon);
        // Appliquer les dégâts
        const afterDmg = applyDamage(result.state, result.anim);
        expect(afterDmg.activationsUsed).toBe(1);
        expect(afterDmg.activatedUnitIds).toContain(u1.id);
        // On peut encore sélectionner u2
        expect(afterDmg.autoEndTurn).toBe(false);
        const next = handleClick(afterDmg, u2.hex);
        expect(next.selectedUnit).not.toBeNull();
        expect(next.selectedUnit.id).toBe(u2.id);
    });

    it("tuer un ennemi en 1ère activation permet de jouer la 2e", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const u2 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        enemy.currentWounds = 1;
        const s = makeState({ units: [u1, u2, enemy] });
        const selected = handleClick(s, u1.hex);
        const clicked = handleClick(selected, enemy.hex);
        const weapon = u1.weapons.find(w => w.id === "sword");
        const result = computeWeaponSelect(clicked, weapon);
        // Simuler dégâts fatals
        const fatalAnim = { ...result.anim, damage: 99, isDead: true };
        const afterKill = applyDamage(result.state, fatalAnim);
        expect(afterKill.activationsUsed).toBe(1);
        expect(afterKill.autoEndTurn).toBe(false);
        // u2 est toujours sélectionnable
        const next = handleClick(afterKill, u2.hex);
        expect(next.selectedUnit.id).toBe(u2.id);
    });

    it("autoEndTurn si une seule unité vivante et déjà activée", () => {
        const u1 = createUnit("warrior", 1, { q: -2, r: 0, s: 2 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const s1 = handleClick(s, u1.hex);
        const s2 = handleClick(s1, s1.validMoves[0]);
        // Une seule unité alliée → autoEndTurn même avec 1 activation
        expect(s2.autoEndTurn).toBe(true);
    });
});

describe("déplacement", () => {
    it("une unité avec mouvement 3 peut atteindre des hexes à 3 cases mais pas à 4", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const reachable = reachableHexes(origin, 3, new Set());
        const reachableKeys = new Set(reachable.map(hexKey));

        expect(reachableKeys.has(hexKey({ q: 1, r: -1, s: 0 }))).toBe(true);
        expect(reachableKeys.has(hexKey({ q: 3, r: -3, s: 0 }))).toBe(true);
        expect(reachableKeys.has(hexKey({ q: 4, r: -4, s: 0 }))).toBe(false);
    });

    it("une unité ne peut pas traverser un hex occupé", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const blocker = { q: 1, r: -1, s: 0 };
        const occupied = new Set([hexKey(blocker)]);
        const reachable = reachableHexes(origin, 3, occupied);
        const reachableKeys = new Set(reachable.map(hexKey));

        expect(reachableKeys.has(hexKey(blocker))).toBe(false);
    });

    it("une unité ne peut pas se déplacer hors de la grille", () => {
        const edgeHex = { q: 5, r: -5, s: 0 };
        const reachable = reachableHexes(edgeHex, 2, new Set());

        for (const hex of reachable) {
            expect(isValidHex(hex)).toBe(true);
        }
    });

    it("le mouvement 0 ne produit aucune destination", () => {
        const origin = { q: 0, r: 0, s: 0 };
        const reachable = reachableHexes(origin, 0, new Set());
        expect(reachable).toHaveLength(0);
    });
});
