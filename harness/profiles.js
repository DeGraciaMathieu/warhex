// Matchups simulés par le harness (PRD 06). Chaque entrée décrit une partie type
// à rejouer N fois : armées des deux camps, terrain, et éventuellement des poids
// de décision IA alternatifs (sinon DEFAULT_AI_WEIGHTS). Modifie/ajoute librement
// des matchups ici — aucun impact sur le jeu.

import { TERRAIN_PRESETS } from "../src/units.js";

const density = id => TERRAIN_PRESETS.find(p => p.id === id).density;

const STANDARD = ["warrior", "warrior", "knight", "sniper", "berserker"];
const SHOOTERS = ["sniper", "sniper", "warrior", "warrior", "warrior"];
const MELEE = ["berserker", "berserker", "knight", "knight", "knight"];

export const MATCHUPS = [
    {
        name: "Miroir standard — terrain par défaut",
        armies: { 1: STANDARD, 2: STANDARD },
        options: { terrainDensity: density("default") },
    },
    {
        name: "Tir (J1) vs Mêlée (J2) — terrain par défaut",
        armies: { 1: SHOOTERS, 2: MELEE },
        options: { terrainDensity: density("default") },
    },
    {
        name: "Miroir standard — plaine ouverte",
        armies: { 1: STANDARD, 2: STANDARD },
        options: { terrainDensity: density("open") },
    },
    {
        name: "Miroir standard — forêt dense",
        armies: { 1: STANDARD, 2: STANDARD },
        options: { terrainDensity: density("forest") },
    },
    {
        name: "IA poussée vers les villes (J2) vs standard (J1)",
        armies: { 1: STANDARD, 2: STANDARD },
        options: { terrainDensity: density("siege") },
        weights: { 2: { captureTown: 90, towardTown: 45 } },
    },
];
