// Matchups simulés par le harness (PRD 06). Chaque entrée décrit une partie type
// à rejouer N fois : armées des deux camps, terrain, et éventuellement des poids
// de décision IA alternatifs (sinon DEFAULT_AI_WEIGHTS). Modifie/ajoute librement
// des matchups ici — aucun impact sur le jeu.

import { TERRAIN_PRESETS } from "../src/units.js";

const density = id => TERRAIN_PRESETS.find(p => p.id === id).density;

const ARMIES = {
    standard: ["warrior", "warrior", "knight", "sniper", "berserker"],
    tir: ["sniper", "sniper", "warrior", "warrior", "warrior"],
    mêlée: ["berserker", "berserker", "knight", "knight", "knight"],
};

const ARMY_LABELS = { standard: "Standard", tir: "Tir", mêlée: "Mêlée" };

// Toutes les combinaisons possibles entre les types d'armée (avec répétition),
// jouées sur le terrain par défaut.
const ARMY_KEYS = Object.keys(ARMIES);

export const MATCHUPS = ARMY_KEYS.flatMap((a, i) =>
    ARMY_KEYS.slice(i).map(b => ({
        name: `${ARMY_LABELS[a]} (J1) vs ${ARMY_LABELS[b]} (J2) — terrain par défaut`,
        armies: { 1: ARMIES[a], 2: ARMIES[b] },
        options: { terrainDensity: density("default") },
    }))
);
