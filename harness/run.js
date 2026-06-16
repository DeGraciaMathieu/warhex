// CLI du harness de statistiques (PRD 06).
//
//   node harness/run.js [N]
//
// Rejoue N parties (défaut 300) pour chaque matchup défini dans profiles.js et
// affiche un récapitulatif console : taux de victoire, durée des parties,
// efficacité par type d'unité (survie + kills) et influence terrain/score.
// Outil isolé : n'importe que des fonctions pures de src/, jamais App.jsx.

import { computeTownControl } from "../src/units.js";
import { runGame } from "./sim.js";
import { MATCHUPS } from "./profiles.js";

const N = Number(process.argv[2]) || 300;

const pct = (x, total) => (total ? (100 * x / total).toFixed(1) : "0.0").padStart(5) + "%";
const num = (x, d = 1) => Number(x).toFixed(d);

function simulateMatchup(matchup) {
    const res = { p1: 0, p2: 0, draw: 0, aborted: 0 };
    let counted = 0, roundsSum = 0, marginSum = 0, towns1Sum = 0, towns2Sum = 0;
    const byType = {};
    const ensure = name => (byType[name] ||= { instances: 0, survived: 0, kills: 0 });

    for (let i = 0; i < N; i++) {
        const { state, kills, aborted } = runGame(matchup);
        if (aborted) { res.aborted++; continue; }
        counted++;
        if (state.winner === 1) res.p1++;
        else if (state.winner === 2) res.p2++;
        else res.draw++;
        roundsSum += state.round;
        marginSum += Math.abs((state.scores[1] || 0) - (state.scores[2] || 0));
        const control = computeTownControl(state.townOwnership || {});
        towns1Sum += control[1];
        towns2Sum += control[2];
        for (const u of state.units) {
            const t = ensure(u.name);
            t.instances++;
            if (u.currentWounds > 0) t.survived++;
        }
        for (const k of kills) ensure(k.killerType).kills++;
    }
    return { res, counted, roundsSum, marginSum, towns1Sum, towns2Sum, byType };
}

function printMatchup(matchup, stats) {
    const { res, counted, roundsSum, marginSum, towns1Sum, towns2Sum, byType } = stats;
    const c = counted || 1;
    console.log(`\n═══ ${matchup.name} ═══  (${N} parties, ${res.aborted} avortées)`);
    console.log(`  Victoires   J1 ${pct(res.p1, counted)}   J2 ${pct(res.p2, counted)}   Nul ${pct(res.draw, counted)}`);
    console.log(`  Rounds moy ${num(roundsSum / c)}   Écart score moy ${num(marginSum / c)}   Villes moy J1 ${num(towns1Sum / c)} / J2 ${num(towns2Sum / c)}`);
    console.log(`  ${"Unité".padEnd(12)}${"Survie".padStart(8)}${"Kills/partie".padStart(14)}`);
    for (const name of Object.keys(byType).sort()) {
        const t = byType[name];
        const survie = pct(t.survived, t.instances);
        console.log(`  ${name.padEnd(12)}${survie.padStart(8)}${num(t.kills / c, 2).padStart(14)}`);
    }
}

console.log(`Warhex — harness de simulation : ${N} parties par matchup, ${MATCHUPS.length} matchups`);
const started = Date.now();
for (const matchup of MATCHUPS) {
    printMatchup(matchup, simulateMatchup(matchup));
}
console.log(`\nTerminé en ${num((Date.now() - started) / 1000)}s.`);
