function rollD6() { return Math.floor(Math.random() * 6) + 1; }
function rollDice(n) { return Array.from({ length: n }, rollD6); }

export function damageMultiplier(str, tough) {
    if (str >= tough * 2) return 2;
    if (str > tough) return 1.5;
    if (str === tough) return 1;
    if (str * 2 <= tough) return 0.25;
    return 0.5;
}

export function resolveAttack(attacker, weapon, target) {
    const log = [];
    const skillStat = weapon.type === "ranged" ? attacker.ballisticSkill : attacker.weaponSkill;

    // — To Hit
    const toHitRolls = rollDice(weapon.attacks);
    const hits = toHitRolls.filter(r => r >= skillStat).length;
    log.push({ label: `🎲 To Hit (${skillStat}+)`, rolls: toHitRolls, success: hits });

    // — Save
    let totalDamage = 0;
    if (hits > 0) {
        const effectiveSave = target.save + Math.abs(weapon.ap);
        const saveRolls = rollDice(hits);
        const cantSave = effectiveSave > 6;
        const saved = cantSave ? 0 : saveRolls.filter(r => r >= effectiveSave).length;
        const unsaved = hits - saved;
        log.push({
            label: cantSave ? `🛡 Sauvegarde (impossible, PA trop fort)` : `🛡 Sauvegarde (${effectiveSave}+)`,
            rolls: saveRolls,
            success: saved,
            isSave: true,
        });

        // — Dégâts avec multiplicateur Force vs Endurance
        const mult = damageMultiplier(weapon.strength, target.toughness);
        const rawDamage = unsaved * weapon.damage;
        totalDamage = Math.max(1, Math.round(rawDamage * mult));
        if (unsaved === 0) totalDamage = 0;
        log.push({ label: `🩸 Puissance (×${mult})`, rolls: [], success: null });
    }

    log.push({ label: `💥 Dégâts infligés : ${totalDamage}`, rolls: [], success: totalDamage, isSummary: true });
    return { damage: totalDamage, log };
}
