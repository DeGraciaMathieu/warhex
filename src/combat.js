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
