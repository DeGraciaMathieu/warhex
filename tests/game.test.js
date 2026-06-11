import { describe, it, expect, beforeEach } from "vitest";
import { hexKey, reachableHexes, isValidHex } from "../src/hex.js";
import { createUnit, resetUID } from "../src/units.js";
import { handleClick, computeMove, computeAttack, computeWeaponSelect, applyDamage, computeEndTurn, computeDeselect, computeConsolidate, getUnitTerrainEffects, getCombatModifiers } from "../src/game.js";

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
        attackRangeHexes: [],
        pendingAttack: null,
        winner: null,
        round: 1,
        scores: { 1: 0, 2: 0 },
        activeUnitId: null,
        activationsUsed: 0,
        activatedUnitIds: [],
        townOwnership: {},
        autoEndTurn: false,
        dyingUnits: [],
        aiPreview: null,
        kills: { 1: 0, 2: 0 },
        scoreHistory: [],
        hitEffects: [],
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

    it("computeWeaponSelect annule si la cible est trop proche (minRange)", () => {
        const attacker = createUnit("sniper", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons.find(w => w.id === "sniper_rifle");
        const s = makeState({ units: [attacker, target], pendingAttack: { attacker, target } });
        const result = computeWeaponSelect(s, weapon);
        expect(result.anim).toBeNull();
        expect(result.state.phase).toBe("select");
    });

    it("un sniper adjacent ne voit pas l'ennemi comme cible valide pour le sniper rifle", () => {
        const sniper = createUnit("sniper", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [sniper, enemy], selectedUnit: sniper, currentPlayer: 1 });
        const result = computeAttack(s);
        // Le pistol (range 1) couvre la distance → la cible reste valide
        expect(result.validTargets.length).toBe(1);
    });

    it("un sniper sans pistol adjacent n'a aucune cible valide", () => {
        const sniper = createUnit("sniper", 1, { q: 0, r: 0, s: 0 });
        sniper.weapons = [sniper.weapons.find(w => w.id === "sniper_rifle")];
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [sniper, enemy], selectedUnit: sniper, currentPlayer: 1 });
        const result = computeAttack(s);
        expect(result.validTargets.length).toBe(0);
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

    it("applyDamage ajoute l'unité tuée à dyingUnits", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 99, weaponName: "Sword", log: [], isDead: true };
        const result = applyDamage(s, anim);
        expect(result.dyingUnits).toHaveLength(1);
        expect(result.dyingUnits[0].symbol).toBe(target.symbol);
        expect(result.dyingUnits[0].player).toBe(2);
        expect(result.dyingUnits[0].hex).toEqual(target.hex);
        expect(result.dyingUnits[0].deathTime).toBeGreaterThan(0);
    });

    it("applyDamage ne remplit pas dyingUnits si la cible survit", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 1, weaponName: "Sword", log: [], isDead: false };
        const result = applyDamage(s, anim);
        expect(result.dyingUnits).toHaveLength(0);
    });
});

describe("consolidation après un kill au corps à corps", () => {
    function meleeKillState(overrides = {}) {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target], ...overrides });
        const anim = { attacker, target, damage: 99, weaponName: "Sword", weaponType: "melee", log: [], isDead: true };
        return { s, attacker, target, anim };
    }

    it("un kill en mêlée adjacent propose la consolidation", () => {
        const { s, attacker, target, anim } = meleeKillState();
        const result = applyDamage(s, anim);
        expect(result.phase).toBe("consolidate");
        expect(result.pendingConsolidation).toEqual({ unitId: attacker.id, hex: target.hex });
        expect(result.validMoves).toEqual([target.hex]);
        expect(result.autoEndTurn).toBe(false);
        expect(result.activationsUsed).toBe(0);
    });

    it("un kill à distance ne propose pas de consolidation", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 99, weaponName: "Rifle", weaponType: "ranged", log: [], isDead: true };
        const result = applyDamage(s, anim);
        expect(result.phase).toBe("select");
        expect(result.pendingConsolidation).toBeUndefined();
        expect(result.activationsUsed).toBe(1);
    });

    it("une attaque en mêlée non létale ne propose pas de consolidation", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 1, weaponName: "Sword", weaponType: "melee", log: [], isDead: false };
        const result = applyDamage(s, anim);
        expect(result.phase).toBe("select");
        expect(result.activationsUsed).toBe(1);
    });

    it("accepter déplace l'attaquant sur l'hex libéré et termine l'activation", () => {
        const { s, attacker, target, anim } = meleeKillState();
        const consolidating = applyDamage(s, anim);
        const result = computeConsolidate(consolidating, true);
        const atk = result.units.find(u => u.id === attacker.id);
        expect(atk.hex).toEqual(target.hex);
        expect(result.pendingConsolidation).toBeNull();
        expect(result.phase).toBe("select");
        expect(result.activationsUsed).toBe(1);
    });

    it("refuser laisse l'attaquant sur place et termine l'activation", () => {
        const { s, attacker, anim } = meleeKillState();
        const consolidating = applyDamage(s, anim);
        const result = computeConsolidate(consolidating, false);
        const atk = result.units.find(u => u.id === attacker.id);
        expect(atk.hex).toEqual(attacker.hex);
        expect(result.pendingConsolidation).toBeNull();
        expect(result.activationsUsed).toBe(1);
    });

    it("consolider sur une ville la capture", () => {
        const { s, target, anim } = meleeKillState({ towns: [{ q: 1, r: -1, s: 0 }] });
        const consolidating = applyDamage(s, anim);
        const result = computeConsolidate(consolidating, true);
        expect(result.townOwnership[hexKey(target.hex)]).toBe(1);
    });

    it("consolider sur un marais inflige 1 dégât", () => {
        const { s, attacker, anim } = meleeKillState({ swamps: [{ q: 1, r: -1, s: 0 }] });
        const consolidating = applyDamage(s, anim);
        const result = computeConsolidate(consolidating, true);
        const atk = result.units.find(u => u.id === attacker.id);
        expect(atk.currentWounds).toBe(attacker.currentWounds - 1);
    });

    it("cliquer sur l'hex libéré accepte la consolidation", () => {
        const { s, attacker, target, anim } = meleeKillState();
        const consolidating = applyDamage(s, anim);
        const result = handleClick(consolidating, target.hex);
        const atk = result.units.find(u => u.id === attacker.id);
        expect(atk.hex).toEqual(target.hex);
        expect(result.pendingConsolidation).toBeNull();
    });

    it("cliquer ailleurs pendant la consolidation ne fait rien", () => {
        const { s, anim } = meleeKillState();
        const consolidating = applyDamage(s, anim);
        const result = handleClick(consolidating, { q: -2, r: 1, s: 1 });
        expect(result).toEqual(consolidating);
    });

    it("computeEndTurn annule une consolidation en attente", () => {
        const { s, anim } = meleeKillState();
        const consolidating = applyDamage(s, anim);
        const result = computeEndTurn(consolidating);
        expect(result.pendingConsolidation).toBeNull();
    });
});

describe("animations d'attaque", () => {
    it("computeWeaponSelect transmet le type d'arme dans l'animation", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const weapon = attacker.weapons.find(w => w.id === "sword");
        const s = makeState({ units: [attacker, target], pendingAttack: { attacker, target } });
        const result = computeWeaponSelect(s, weapon);
        expect(result.anim.weaponType).toBe("melee");
    });

    it("applyDamage déclenche une animation d'attaque vers la cible quand des dégâts sont infligés", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 2, weaponName: "Rifle", weaponType: "ranged", log: [], isDead: false };
        const result = applyDamage(s, anim);
        expect(result.attackEffects).toHaveLength(1);
        expect(result.attackEffects[0].from).toEqual(attacker.hex);
        expect(result.attackEffects[0].to).toEqual(target.hex);
        expect(result.attackEffects[0].weaponType).toBe("ranged");
        expect(result.attackEffects[0].time).toBeGreaterThan(0);
    });

    it("applyDamage ne déclenche pas d'animation d'attaque si l'attaque ne fait aucun dégât", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const anim = { attacker, target, damage: 0, weaponName: "Sword", weaponType: "melee", log: [], isDead: false };
        const result = applyDamage(s, anim);
        expect(result.attackEffects).toHaveLength(0);
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
        const s = makeState({ units: [u1], towns: [town], currentPlayer: 2, townOwnership: { [hexKey(town)]: 1 } });
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

    it("computeEndTurn alimente scoreHistory en fin de round", () => {
        const town = { q: 0, r: 0, s: 0 };
        const u1 = createUnit("warrior", 1, town);
        const s = makeState({ units: [u1], towns: [town], currentPlayer: 2, round: 2, townOwnership: { [hexKey(town)]: 1 } });
        const result = computeEndTurn(s);
        expect(result.scoreHistory).toHaveLength(1);
        expect(result.scoreHistory[0]).toEqual({ round: 2, scores: { 1: 1, 2: 0 } });
    });

    it("computeEndTurn ne modifie pas scoreHistory en milieu de round", () => {
        const s = makeState({ currentPlayer: 1, round: 2 });
        const result = computeEndTurn(s);
        expect(result.scoreHistory).toEqual([]);
    });
});

describe("tracking des kills", () => {
    it("applyDamage incrémente les kills quand une unité est éliminée", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        target.currentWounds = 1;
        const s = makeState({ units: [attacker, target], selectedUnit: attacker, activeUnitId: attacker.id });
        const anim = { attacker, target, damage: 1, weaponName: "Épée", log: [], isDead: true };
        const result = applyDamage(s, anim);
        expect(result.kills[1]).toBe(1);
        expect(result.kills[2]).toBe(0);
    });

    it("applyDamage ne modifie pas les kills sans élimination", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        const s = makeState({ units: [attacker, target], selectedUnit: attacker, activeUnitId: attacker.id });
        const anim = { attacker, target, damage: 1, weaponName: "Épée", log: [], isDead: false };
        const result = applyDamage(s, anim);
        expect(result.kills[1]).toBe(0);
    });
});

describe("effets visuels de combat", () => {
    it("applyDamage crée un hitEffect quand il y a des dégâts", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        const s = makeState({ units: [attacker, target], selectedUnit: attacker, activeUnitId: attacker.id });
        const anim = { attacker, target, damage: 2, weaponName: "Épée", log: [], isDead: false };
        const result = applyDamage(s, anim);
        expect(result.hitEffects).toHaveLength(1);
        expect(result.hitEffects[0].hex).toEqual(target.hex);
        expect(result.hitEffects[0].damage).toBe(2);
    });

    it("applyDamage ne crée pas de hitEffect si dégâts à 0", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        const s = makeState({ units: [attacker, target], selectedUnit: attacker, activeUnitId: attacker.id });
        const anim = { attacker, target, damage: 0, weaponName: "Épée", log: [], isDead: false };
        const result = applyDamage(s, anim);
        expect(result.hitEffects).toHaveLength(0);
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
    it("une colline intermédiaire empêche de cibler un ennemi", () => {
        const hill = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target], hills: [hill] });
        const selected = handleClick(s, attacker.hex);
        expect(selected.validTargets.some(t => t.id === target.id)).toBe(false);
    });

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

    it("une unité tuée par le marais est ajoutée à dyingUnits", () => {
        const swamp = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("sniper", 1, { q: -1, r: 0, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [attacker, enemy], swamps: [swamp] });
        const selected = handleClick(s, { q: -1, r: 0, s: 1 });
        const moved = handleClick(selected, swamp);
        expect(moved.dyingUnits).toHaveLength(1);
        expect(moved.dyingUnits[0].symbol).toBe(attacker.symbol);
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
        // Appliquer des dégâts non létaux (un kill en mêlée ouvrirait la consolidation)
        const afterDmg = applyDamage(result.state, { ...result.anim, damage: 1, isDead: false });
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
        // Simuler dégâts fatals — le kill en mêlée ouvre la consolidation
        const fatalAnim = { ...result.anim, damage: 99, isDead: true };
        const consolidating = applyDamage(result.state, fatalAnim);
        const afterKill = computeConsolidate(consolidating, false);
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

    it("on ne peut pas sélectionner une 3e unité quand autoEndTurn est true", () => {
        const u1 = createUnit("warrior", 1, { q: -2, r: 0, s: 2 });
        const u2 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const u3 = createUnit("warrior", 1, { q: -4, r: 1, s: 3 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({
            units: [u1, u2, u3, enemy],
            activationsUsed: 2,
            activatedUnitIds: [u1.id, u2.id],
            autoEndTurn: true,
        });
        const result = handleClick(s, u3.hex);
        expect(result.selectedUnit).toBeNull();
    });
});

describe("tour de l'adversaire", () => {
    it("le joueur 1 ne peut pas sélectionner ses unités quand currentPlayer est 2", () => {
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        const s = makeState({ units: [u1, enemy], currentPlayer: 2 });
        const result = handleClick(s, u1.hex);
        expect(result.selectedUnit).toBeNull();
    });

    it("le joueur 2 ne peut pas sélectionner les unités du joueur 1 quand currentPlayer est 1", () => {
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 1, r: 0, s: -1 });
        const s = makeState({ units: [u1, enemy], currentPlayer: 1 });
        const result = handleClick(s, enemy.hex);
        expect(result.selectedUnit).toBeNull();
    });

    it("computeEndTurn change le joueur actif", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 2, r: -2, s: 0 });
        const s = makeState({ units: [u1, enemy], currentPlayer: 1 });
        const result = computeEndTurn(s);
        expect(result.currentPlayer).toBe(2);
    });
});

describe("phases bloquantes", () => {
    it("handleClick ne fait rien en phase weapon_select", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [u1, enemy], phase: "weapon_select", pendingAttack: { attacker: u1, target: enemy } });
        const result = handleClick(s, { q: -1, r: 0, s: 1 });
        expect(result).toEqual(s);
    });

    it("handleClick ne fait rien en phase resolving", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [u1, enemy], phase: "resolving" });
        const result = handleClick(s, { q: 0, r: 0, s: 0 });
        expect(result).toEqual(s);
    });

    it("cliquer sur un hex vide sans action valide ne change rien", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const result = handleClick(s, { q: -3, r: 3, s: 0 });
        expect(result).toEqual(s);
    });

    it("une unité morte ne peut pas être sélectionnée", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        u1.currentWounds = 0;
        const enemy = createUnit("warrior", 2, { q: 2, r: -2, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const result = handleClick(s, u1.hex);
        expect(result.selectedUnit).toBeNull();
    });

    it("une unité morte n'est pas une cible d'attaque valide", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const deadEnemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        deadEnemy.currentWounds = 0;
        const s = makeState({ units: [attacker, deadEnemy] });
        const selected = handleClick(s, attacker.hex);
        expect(selected.validTargets.some(t => t.id === deadEnemy.id)).toBe(false);
    });
});

describe("désélection par clic sur hex vide", () => {
    it("cliquer sur un hex vide avec une unité sélectionnée la désélectionne", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const selected = handleClick(s, u1.hex);
        expect(selected.selectedUnit).not.toBeNull();
        const deselected = handleClick(selected, { q: -4, r: 4, s: 0 });
        expect(deselected.selectedUnit).toBeNull();
        expect(deselected.phase).toBe("select");
    });

    it("cliquer sur un hex vide après avoir agi consomme l'activation", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const u2 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({ units: [u1, u2, enemy] });
        const selected = handleClick(s, u1.hex);
        const moved = handleClick(selected, { q: -1, r: 0, s: 1 });
        // L'unité a bougé loin de l'ennemi → activation auto-consommée
        expect(moved.activationsUsed).toBe(1);
    });
});

describe("flux déplacement puis attaque", () => {
    it("après un déplacement à portée d'un ennemi, les cibles sont affichées", () => {
        const u1 = createUnit("warrior", 1, { q: -2, r: 0, s: 2 });
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const selected = handleClick(s, u1.hex);
        // Se déplacer vers un hex adjacent à l'ennemi
        const moveTarget = { q: 0, r: 0, s: 0 };
        expect(selected.validMoves.map(hexKey)).toContain(hexKey(moveTarget));
        const moved = handleClick(selected, moveTarget);
        expect(moved.validTargets.length).toBeGreaterThan(0);
        expect(moved.validTargets.some(t => t.id === enemy.id)).toBe(true);
    });

    it("après un déplacement loin d'un ennemi, pas de cibles et activation consommée", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const selected = handleClick(s, u1.hex);
        const moveTarget = { q: -1, r: 0, s: 1 };
        const moved = handleClick(selected, moveTarget);
        expect(moved.activationsUsed).toBe(1);
        expect(moved.selectedUnit).toBeNull();
    });
});

describe("couvert de ville en combat", () => {
    it("une cible dans une ville subit moins de dégâts en moyenne", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const town = { q: 1, r: -1, s: 0 };
        const weapon = attacker.weapons.find(w => w.id === "sword");

        let totalWithTown = 0, totalNoTown = 0;
        for (let i = 0; i < 500; i++) {
            const sWithTown = makeState({ units: [attacker, target], towns: [town], pendingAttack: { attacker, target } });
            const sNoTown = makeState({ units: [attacker, target], towns: [], pendingAttack: { attacker, target } });
            const rWith = computeWeaponSelect(sWithTown, weapon);
            const rNo = computeWeaponSelect(sNoTown, weapon);
            if (rWith.anim) totalWithTown += rWith.anim.damage;
            if (rNo.anim) totalNoTown += rNo.anim.damage;
        }
        expect(totalNoTown).toBeGreaterThan(totalWithTown);
    });
});

describe("couvert de forêt en combat", () => {
    it("une cible dans une forêt subit moins de dégâts en moyenne", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const forest = { q: 1, r: -1, s: 0 };
        const weapon = attacker.weapons.find(w => w.id === "sword");

        let totalWithForest = 0, totalNoForest = 0;
        for (let i = 0; i < 500; i++) {
            const sWithForest = makeState({ units: [attacker, target], forests: [forest], pendingAttack: { attacker, target } });
            const sNoForest = makeState({ units: [attacker, target], forests: [], pendingAttack: { attacker, target } });
            const rWith = computeWeaponSelect(sWithForest, weapon);
            const rNo = computeWeaponSelect(sNoForest, weapon);
            if (rWith.anim) totalWithForest += rWith.anim.damage;
            if (rNo.anim) totalNoForest += rNo.anim.damage;
        }
        expect(totalNoForest).toBeGreaterThan(totalWithForest);
    });
});

describe("malus rivière en combat", () => {
    it("une cible sur une rivière subit plus de dégâts en moyenne", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const river = { q: 1, r: -1, s: 0 };
        const weapon = attacker.weapons.find(w => w.id === "sword");

        let totalWithRiver = 0, totalNoRiver = 0;
        for (let i = 0; i < 500; i++) {
            const sWithRiver = makeState({ units: [attacker, target], rivers: [river], pendingAttack: { attacker, target } });
            const sNoRiver = makeState({ units: [attacker, target], rivers: [], pendingAttack: { attacker, target } });
            const rWith = computeWeaponSelect(sWithRiver, weapon);
            const rNo = computeWeaponSelect(sNoRiver, weapon);
            if (rWith.anim) totalWithRiver += rWith.anim.damage;
            if (rNo.anim) totalNoRiver += rNo.anim.damage;
        }
        expect(totalWithRiver).toBeGreaterThan(totalNoRiver);
    });
});

describe("indicateurs de terrain", () => {
    it("une unité sur une ville a l'effet cover", () => {
        const town = { q: 0, r: 0, s: 0 };
        const unit = createUnit("warrior", 1, town);
        const s = makeState({ units: [unit], towns: [town] });
        expect(getUnitTerrainEffects(unit, s)).toEqual(["cover"]);
    });

    it("une unité sur une forêt a l'effet cover", () => {
        const forest = { q: 0, r: 0, s: 0 };
        const unit = createUnit("warrior", 1, forest);
        const s = makeState({ units: [unit], forests: [forest] });
        expect(getUnitTerrainEffects(unit, s)).toEqual(["cover"]);
    });

    it("une unité sur une rivière a l'effet river", () => {
        const river = { q: 0, r: 0, s: 0 };
        const unit = createUnit("warrior", 1, river);
        const s = makeState({ units: [unit], rivers: [river] });
        expect(getUnitTerrainEffects(unit, s)).toEqual(["river"]);
    });

    it("une unité sur une colline a l'effet hill", () => {
        const hill = { q: 0, r: 0, s: 0 };
        const unit = createUnit("warrior", 1, hill);
        const s = makeState({ units: [unit], hills: [hill] });
        expect(getUnitTerrainEffects(unit, s)).toEqual(["hill"]);
    });

    it("une unité sur un terrain neutre n'a aucun effet", () => {
        const unit = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const s = makeState({ units: [unit] });
        expect(getUnitTerrainEffects(unit, s)).toEqual([]);
    });

    it("une unité sur un marais n'a aucun effet visuel", () => {
        const swamp = { q: 0, r: 0, s: 0 };
        const unit = createUnit("warrior", 1, swamp);
        const s = makeState({ units: [unit], swamps: [swamp] });
        expect(getUnitTerrainEffects(unit, s)).toEqual([]);
    });
});

describe("fin de partie", () => {
    it("computeEndTurn déclare un gagnant au round 7", () => {
        const town = { q: 0, r: 0, s: 0 };
        const u1 = createUnit("warrior", 1, town);
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({
            units: [u1, enemy], towns: [town], currentPlayer: 2,
            round: 7, scores: { 1: 3, 2: 1 },
            townOwnership: { [hexKey(town)]: 1 },
        });
        const result = computeEndTurn(s);
        expect(result.winner).not.toBeNull();
    });

    it("computeEndTurn ne déclare pas de gagnant avant le round 7", () => {
        const town = { q: 0, r: 0, s: 0 };
        const u1 = createUnit("warrior", 1, town);
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({
            units: [u1, enemy], towns: [town], currentPlayer: 2,
            round: 4, scores: { 1: 10, 2: 0 },
            townOwnership: { [hexKey(town)]: 1 },
        });
        const result = computeEndTurn(s);
        expect(result.winner).toBeNull();
    });
});

describe("mort par marais et fin d'activation", () => {
    it("une unité tuée par le poison du marais termine l'activation", () => {
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        u1.currentWounds = 1;
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const swamp = { q: 0, r: 0, s: 0 };
        const s = makeState({
            units: [u1, enemy],
            swamps: [swamp],
            selectedUnit: u1,
            activeUnitId: u1.id,
            phase: "move",
            validMoves: [swamp],
        });
        const result = handleClick(s, swamp);
        const dead = result.units.find(u => u.id === u1.id);
        expect(dead.currentWounds).toBe(0);
        expect(result.selectedUnit).toBeNull();
        expect(result.phase).toBe("select");
    });

    it("une unité tuée par le marais ne bloque pas l'activation de la suivante", () => {
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        u1.currentWounds = 1;
        const u2 = createUnit("warrior", 1, { q: -2, r: 1, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const swamp = { q: 0, r: 0, s: 0 };
        const s = makeState({
            units: [u1, u2, enemy],
            swamps: [swamp],
            selectedUnit: u1,
            activeUnitId: u1.id,
            phase: "move",
            validMoves: [swamp],
        });
        const result = handleClick(s, swamp);
        expect(result.autoEndTurn).toBe(false);
        expect(result.phase).toBe("select");
    });
});

describe("autoEndTurn quand plus d'alliés disponibles", () => {
    it("autoEndTurn est true si toutes les unités alliées ont été activées", () => {
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const u2 = createUnit("warrior", 1, { q: -2, r: 1, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({
            units: [u1, u2, enemy],
            activationsUsed: 1,
            activatedUnitIds: [u1.id],
            selectedUnit: u2,
            activeUnitId: u2.id,
        });
        const result = computeDeselect({ ...s, units: s.units.map(u => u.id === u2.id ? { ...u, hasMoved: true } : u) });
        expect(result.autoEndTurn).toBe(true);
    });

    it("autoEndTurn est true si la seule unité restante meurt dans un marais", () => {
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        u1.currentWounds = 1;
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const swamp = { q: 0, r: 0, s: 0 };
        const s = makeState({
            units: [u1, enemy],
            swamps: [swamp],
            selectedUnit: u1,
            activeUnitId: u1.id,
            phase: "move",
            validMoves: [swamp],
        });
        const result = handleClick(s, swamp);
        expect(result.autoEndTurn).toBe(true);
    });
});

describe("arme hors portée rejetée", () => {
    it("computeWeaponSelect rejette une arme mêlée si la cible est hors portée", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const melee = attacker.weapons.find(w => w.type === "melee");
        const s = makeState({
            units: [attacker, target],
            pendingAttack: { attacker, target },
        });
        const result = computeWeaponSelect(s, melee);
        expect(result.anim).toBeNull();
    });

    it("computeWeaponSelect accepte une arme à distance avec bonus de colline", () => {
        const attacker = createUnit("sniper", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const ranged = attacker.weapons[0]; // range 3
        const hill = { q: 0, r: 0, s: 0 };
        const s = makeState({
            units: [attacker, target],
            hills: [hill],
            pendingAttack: { attacker, target },
        });
        const result = computeWeaponSelect(s, ranged);
        expect(result.anim).not.toBeNull();
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

describe("capture de villes", () => {
    it("se déplacer sur une ville la capture pour le joueur", () => {
        const town = { q: 0, r: 0, s: 0 };
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [u1, enemy], towns: [town] });
        const selected = handleClick(s, u1.hex);
        const moved = handleClick(selected, town);
        expect(moved.townOwnership[hexKey(town)]).toBe(1);
    });

    it("un adversaire peut reprendre une ville capturée", () => {
        const town = { q: 0, r: 0, s: 0 };
        const u2 = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const enemy = createUnit("warrior", 1, { q: -3, r: 3, s: 0 });
        const s = makeState({
            units: [u2, enemy],
            towns: [town],
            currentPlayer: 2,
            townOwnership: { [hexKey(town)]: 1 },
        });
        const selected = handleClick(s, u2.hex);
        const moved = handleClick(selected, town);
        expect(moved.townOwnership[hexKey(town)]).toBe(2);
    });

    it("se déplacer sur un hex sans ville ne change pas townOwnership", () => {
        const town = { q: 2, r: -2, s: 0 };
        const u1 = createUnit("warrior", 1, { q: -1, r: 0, s: 1 });
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [u1, enemy], towns: [town] });
        const selected = handleClick(s, u1.hex);
        const moved = handleClick(selected, { q: 0, r: 0, s: 0 });
        expect(moved.townOwnership).toEqual({});
    });

    it("une ville capturée reste au joueur même sans unité dessus", () => {
        const town = { q: 0, r: 0, s: 0 };
        const ownership = { [hexKey(town)]: 1 };
        const u1 = createUnit("warrior", 1, { q: -2, r: 0, s: 2 });
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [u1, enemy], towns: [town], townOwnership: ownership });
        // Le joueur se déplace ailleurs, la ville reste à lui
        const selected = handleClick(s, u1.hex);
        const moved = handleClick(selected, { q: -1, r: 0, s: 1 });
        expect(moved.townOwnership[hexKey(town)]).toBe(1);
    });
});

describe("pas de cibles valides", () => {
    it("computeAttack retourne des validTargets vides quand tous les ennemis sont hors portée", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const farEnemy = createUnit("warrior", 2, { q: 6, r: -6, s: 0 });
        const s = makeState({ units: [attacker, farEnemy], selectedUnit: attacker, activeUnitId: attacker.id });
        const result = computeAttack(s);
        expect(result.validTargets).toHaveLength(0);
    });

    it("computeAttack retourne des validTargets vides quand la LOS est bloquée", () => {
        const obstacle = { q: 1, r: -1, s: 0 };
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 2, r: -2, s: 0 });
        const s = makeState({ units: [attacker, enemy], obstacles: [obstacle], selectedUnit: attacker, activeUnitId: attacker.id });
        const result = computeAttack(s);
        expect(result.validTargets).toHaveLength(0);
    });
});

describe("attaque sur cible en rivière", () => {
    it("le workflow complet (weapon select) inflige plus de dégâts sur une cible en rivière", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const river = { q: 1, r: -1, s: 0 };
        const weapon = attacker.weapons.find(w => w.id === "sword");

        let totalWithRiver = 0, totalNoRiver = 0;
        for (let i = 0; i < 500; i++) {
            const sRiver = makeState({ units: [attacker, target], rivers: [river], pendingAttack: { attacker, target } });
            const sNoRiver = makeState({ units: [attacker, target], pendingAttack: { attacker, target } });
            const rRiver = computeWeaponSelect(sRiver, weapon);
            const rNoRiver = computeWeaponSelect(sNoRiver, weapon);
            if (rRiver.anim) totalWithRiver += rRiver.anim.damage;
            if (rNoRiver.anim) totalNoRiver += rNoRiver.anim.damage;
        }
        expect(totalWithRiver).toBeGreaterThan(totalNoRiver);
    });
});

describe("portée d'attaque à la sélection", () => {
    it("sélectionner une unité remplit attackRangeHexes", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 4, r: -4, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const selected = handleClick(s, u1.hex);
        expect(selected.attackRangeHexes.length).toBeGreaterThan(0);
    });

    it("attackRangeHexes inclut des hexes accessibles depuis les cases de déplacement", () => {
        const u1 = createUnit("warrior", 1, { q: -3, r: 0, s: 3 });
        const enemy = createUnit("warrior", 2, { q: 3, r: -3, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const selected = handleClick(s, u1.hex);
        // L'ennemi est à distance 6, hors portée depuis la position actuelle
        // mais certains hexes proches de l'ennemi doivent être dans attackRangeHexes
        // car l'unité peut se déplacer puis attaquer
        const rangeKeys = new Set(selected.attackRangeHexes.map(hexKey));
        const moveKeys = new Set(selected.validMoves.map(hexKey));
        // Il doit y avoir des hexes dans attackRangeHexes qui ne sont pas des cases de déplacement
        const rangeOnly = selected.attackRangeHexes.filter(h => !moveKeys.has(hexKey(h)));
        expect(rangeOnly.length).toBeGreaterThan(0);
    });

    it("attackRangeHexes est vide si l'unité a déjà attaqué", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        u1.hasAttacked = true;
        const enemy = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const selected = handleClick(s, u1.hex);
        expect(selected.attackRangeHexes).toHaveLength(0);
    });

    it("attackRangeHexes est vidé à la désélection", () => {
        const u1 = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const enemy = createUnit("warrior", 2, { q: 2, r: -2, s: 0 });
        const s = makeState({ units: [u1, enemy] });
        const selected = handleClick(s, u1.hex);
        expect(selected.attackRangeHexes.length).toBeGreaterThan(0);
        const deselected = computeDeselect(selected);
        expect(deselected.attackRangeHexes).toHaveLength(0);
    });
});

describe("modificateurs de combat", () => {
    it("attaquant sur colline retourne un bonus colline côté attaquant", () => {
        const hill = { q: 0, r: 0, s: 0 };
        const attacker = createUnit("warrior", 1, hill);
        const target = createUnit("warrior", 2, { q: 2, r: -2, s: 0 });
        const s = makeState({ units: [attacker, target], hills: [hill] });
        const mods = getCombatModifiers(attacker, target, s);
        expect(mods.attacker).toHaveLength(1);
        expect(mods.attacker[0].type).toBe("bonus");
        expect(mods.attacker[0].icon).toBe("⛰");
        expect(mods.target).toHaveLength(0);
    });

    it("cible dans une ville retourne un bonus côté défenseur", () => {
        const town = { q: 1, r: -1, s: 0 };
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, town);
        const s = makeState({ units: [attacker, target], towns: [town] });
        const mods = getCombatModifiers(attacker, target, s);
        expect(mods.target).toHaveLength(1);
        expect(mods.target[0].type).toBe("bonus");
        expect(mods.target[0].icon).toBe("🏰");
        expect(mods.attacker).toHaveLength(0);
    });

    it("cible dans une forêt retourne un bonus côté défenseur", () => {
        const forest = { q: 1, r: -1, s: 0 };
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, forest);
        const s = makeState({ units: [attacker, target], forests: [forest] });
        const mods = getCombatModifiers(attacker, target, s);
        expect(mods.target).toHaveLength(1);
        expect(mods.target[0].type).toBe("bonus");
        expect(mods.target[0].icon).toBe("🌲");
        expect(mods.attacker).toHaveLength(0);
    });

    it("cible sur une rivière retourne un malus côté défenseur", () => {
        const river = { q: 1, r: -1, s: 0 };
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, river);
        const s = makeState({ units: [attacker, target], rivers: [river] });
        const mods = getCombatModifiers(attacker, target, s);
        expect(mods.target).toHaveLength(1);
        expect(mods.target[0].type).toBe("malus");
        expect(mods.target[0].icon).toBe("🏞");
        expect(mods.attacker).toHaveLength(0);
    });

    it("aucun terrain spécial retourne des listes vides", () => {
        const attacker = createUnit("warrior", 1, { q: 0, r: 0, s: 0 });
        const target = createUnit("warrior", 2, { q: 1, r: -1, s: 0 });
        const s = makeState({ units: [attacker, target] });
        const mods = getCombatModifiers(attacker, target, s);
        expect(mods.attacker).toHaveLength(0);
        expect(mods.target).toHaveLength(0);
    });

    it("modificateurs séparés par combattant (colline attaquant + couvert ville défenseur)", () => {
        const hill = { q: 0, r: 0, s: 0 };
        const town = { q: 1, r: -1, s: 0 };
        const attacker = createUnit("warrior", 1, hill);
        const target = createUnit("warrior", 2, town);
        const s = makeState({ units: [attacker, target], hills: [hill], towns: [town] });
        const mods = getCombatModifiers(attacker, target, s);
        expect(mods.attacker).toHaveLength(1);
        expect(mods.attacker[0].icon).toBe("⛰");
        expect(mods.target).toHaveLength(1);
        expect(mods.target[0].icon).toBe("🏰");
    });
});
