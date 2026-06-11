import { hexDistance, hasLineOfSight } from "./hex.js";

function rollD6() { return Math.floor(Math.random() * 6) + 1; }
function rollDice(n) { return Array.from({ length: n }, rollD6); }

export function resolveAttack(attacker, weapon, target, { coverBonus = 0, penalty = 0 } = {}) {
    const log = [];
    const skillStat = weapon.type === "ranged" ? attacker.ballisticSkill : attacker.weaponSkill;

    // — To Hit
    const toHitRolls = rollDice(weapon.attacks);
    const hits = toHitRolls.filter(r => r >= skillStat).length;
    log.push({ label: `🎲 To Hit (${skillStat}+)`, rolls: toHitRolls, success: hits });

    // — Save
    let totalDamage = 0;
    if (hits > 0) {
        const effectiveSave = target.save - coverBonus + penalty + Math.abs(weapon.ap);
        const saveRolls = rollDice(3);
        const cantSave = effectiveSave > 6;
        const saved = cantSave ? 0 : saveRolls.filter(r => r >= effectiveSave).length;
        const unsaved = Math.max(0, hits - saved);
        log.push({
            label: cantSave ? `🛡 Sauvegarde (impossible, PA trop fort)` : `🛡 Sauvegarde (${effectiveSave}+)`,
            rolls: saveRolls,
            success: saved,
            isSave: true,
        });

        totalDamage = unsaved * weapon.damage;
    }

    log.push({ label: `💥 Dégâts infligés : ${totalDamage}`, rolls: [], success: totalDamage, isSummary: true });
    return { damage: totalDamage, log };
}

function binomialProbs(n, p) {
    const probs = [];
    for (let k = 0; k <= n; k++) {
        let c = 1;
        for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
        probs.push(c * p ** k * (1 - p) ** (n - k));
    }
    return probs;
}

export function expectedDamage(attacker, weapon, target, { coverBonus = 0, penalty = 0 } = {}) {
    const skillStat = weapon.type === "ranged" ? attacker.ballisticSkill : attacker.weaponSkill;
    const pHit = Math.min(1, Math.max(0, (7 - skillStat) / 6));
    const effectiveSave = target.save - coverBonus + penalty + Math.abs(weapon.ap);
    const pSave = effectiveSave > 6 ? 0 : Math.min(1, Math.max(0, (7 - effectiveSave) / 6));

    const hitProbs = binomialProbs(weapon.attacks, pHit);
    const saveProbs = binomialProbs(3, pSave);
    let expectedUnsaved = 0;
    for (let h = 1; h < hitProbs.length; h++) {
        for (let s = 0; s < h && s < saveProbs.length; s++) {
            expectedUnsaved += hitProbs[h] * saveProbs[s] * (h - s);
        }
    }
    return expectedUnsaved * weapon.damage;
}

export function findValidTargets(unit, enemies, losKeys, rangeBonus = 0) {
    return enemies.filter(e => {
        const dist = hexDistance(unit.hex, e.hex);
        if (!hasLineOfSight(unit.hex, e.hex, losKeys)) return false;
        return unit.weapons.some(w => {
            const bonus = (w.type === "ranged" ? rangeBonus : 0);
            return dist >= (w.minRange || 1) && dist <= w.range + bonus;
        });
    });
}
