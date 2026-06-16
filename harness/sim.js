// Moteur de simulation headless pour le harness de statistiques (PRD 06).
//
// Rejoue une partie complète IA contre IA sans React, sans timers ni animations,
// en n'utilisant que les fonctions pures du jeu (src/game.js, src/ai.js). Aucun
// fichier de src/ n'importe ce module : le harness reste totalement isolé et sans
// impact sur le comportement du jeu.

import { initState, resetUID } from "../src/units.js";
import { computeAIAction, DEFAULT_AI_WEIGHTS } from "../src/ai.js";
import { handleClick, computeWeaponSelect, applyDamage, computeEndTurn, computeConsolidate, computeCancelAttack } from "../src/game.js";

const swapPlayer = p => (p === 1 ? 2 : p === 2 ? 1 : p);

// Adaptateur de perspective : ai.js est câblé pour jouer le joueur 2 (ses unités
// === 2, ennemis === 1). Pour lui faire jouer le joueur 1, on lui présente une
// vue de l'état où les labels de joueur sont permutés (1↔2). Les positions, le
// terrain et les identifiants d'unité sont inchangés, donc l'action retournée
// (référencée par hex/arme en coordonnées absolues) s'applique telle quelle sur
// l'état réel non permuté.
export function mirrorState(s) {
    const units = s.units.map(u => ({ ...u, player: swapPlayer(u.player) }));
    const byId = new Map(units.map(u => [u.id, u]));
    const townOwnership = {};
    for (const [k, v] of Object.entries(s.townOwnership || {})) townOwnership[k] = swapPlayer(v);
    const remap = u => (u ? byId.get(u.id) || { ...u, player: swapPlayer(u.player) } : null);
    return {
        ...s,
        units,
        townOwnership,
        currentPlayer: swapPlayer(s.currentPlayer),
        selectedUnit: remap(s.selectedUnit),
        pendingAttack: s.pendingAttack
            ? { ...s.pendingAttack, attacker: remap(s.pendingAttack.attacker), target: remap(s.pendingAttack.target) }
            : null,
    };
}

// Décision IA pour le joueur courant, en appliquant l'adaptateur de perspective
// pour le joueur 1. `weights` = { 1, 2 } : poids de décision par joueur.
export function getAIAction(state, weights) {
    if (state.currentPlayer === 1) return computeAIAction(mirrorState(state), weights[1]);
    return computeAIAction(state, weights[2]);
}

// Applique une action IA sur l'état réel via les fonctions pures du jeu. Retourne
// le nouvel état et, le cas échéant, l'événement de kill (pour les stats).
export function applyAction(state, action) {
    switch (action.type) {
        case "endTurn": return { state: computeEndTurn(state), kill: null };
        case "click": return { state: handleClick(state, action.hex), kill: null };
        case "consolidate": return { state: computeConsolidate(state, action.accept), kill: null };
        case "cancel": return { state: computeCancelAttack(state), kill: null };
        case "weapon": {
            const result = computeWeaponSelect(state, action.weapon);
            if (!result) return { state, kill: null };
            if (result.anim) {
                const next = applyDamage(result.state, result.anim);
                const kill = result.anim.isDead
                    ? { killerType: result.anim.attacker.name, killerPlayer: result.anim.attacker.player, victimType: result.anim.target.name }
                    : null;
                return { state: next, kill };
            }
            return { state: result.state, kill: null };
        }
        default: return { state, kill: null };
    }
}

// Joue une partie complète et retourne le résultat brut.
// `aborted` = true si le plafond de pas a été atteint (boucle pathologique),
// la partie est alors exclue des moyennes de victoire.
export function runGame({ armies, options = {}, weights = {} } = {}) {
    resetUID();
    let state = initState(armies, options);
    const w = { 1: weights[1] || DEFAULT_AI_WEIGHTS, 2: weights[2] || DEFAULT_AI_WEIGHTS };
    const kills = [];
    const MAX_STEPS = 5000;
    let steps = 0;
    let aborted = false;

    while (!state.winner) {
        if (steps++ >= MAX_STEPS) { aborted = true; break; }
        if (state.autoEndTurn) { state = computeEndTurn(state); continue; }
        const action = getAIAction(state, w);
        if (!action) { state = computeEndTurn(state); continue; }
        const before = state;
        const res = applyAction(state, action);
        state = res.state;
        if (res.kill) kills.push(res.kill);
        // Action ignorée (même référence d'état) : on force la fin de tour pour
        // garantir la progression et éviter toute boucle.
        if (state === before) state = computeEndTurn(state);
    }

    return { state, kills, aborted };
}
