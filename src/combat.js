function rollD6() { return Math.floor(Math.random() * 6) + 1; }
function rollDice(n) { return Array.from({ length: n }, rollD6); }

export function woundThreshold(str, tough) {
    if (str >= tough * 2) return 2;
    if (str > tough) return 3;
    if (str === tough) return 4;
    if (str * 2 <= tough) return 6;
    return 5;
}

export function resolveAttack(attacker, weapon, target) {
    const log = [];
    const skillStat = weapon.type === "ranged" ? attacker.ballisticSkill : attacker.weaponSkill;

    // — To Hit
    const toHitRolls = rollDice(weapon.attacks);
    const hits = toHitRolls.filter(r => r >= skillStat).length;
    log.push({ label: `🎲 To Hit (${skillStat}+)`, rolls: toHitRolls, success: hits });

    // — To Wound
    let wounds = 0;
    if (hits > 0) {
        const threshold = woundThreshold(weapon.strength, target.toughness);
        const toWoundRolls = rollDice(hits);
        wounds = toWoundRolls.filter(r => r >= threshold).length;
        log.push({ label: `🩸 To Wound (${threshold}+)`, rolls: toWoundRolls, success: wounds });
    }

    // — Save
    let totalDamage = 0;
    if (wounds > 0) {
        const effectiveSave = target.save + Math.abs(weapon.ap);
        const saveRolls = rollDice(wounds);
        const cantSave = effectiveSave > 6;
        const saved = cantSave ? 0 : saveRolls.filter(r => r >= effectiveSave).length;
        const unsaved = wounds - saved;
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
