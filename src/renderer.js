import { HEX_SIZE, hexToPixel, hexKey, isValidHex, hexCorners } from "./hex.js";
import { getUnitTerrainEffects } from "./game.js";

export const CANVAS_W = 700;
export const CANVAS_H = 616;
export const OX = CANVAS_W / 2;
export const OY = CANVAS_H / 2;

export const DEATH_ANIM_DURATION = 600;
export const HIT_EFFECT_DURATION = 500;
export const ATTACK_EFFECT_DURATION = 400;
export const MOVE_ANIM_PER_HEX = 110;
export const MOVE_ANIM_MAX = 700;

// Durée totale de l'animation de déplacement (proportionnelle au nombre de
// cases, plafonnée pour rester réactive).
export function moveAnimDuration(path) {
    return Math.min((path.length - 1) * MOVE_ANIM_PER_HEX, MOVE_ANIM_MAX);
}

// Position pixel (repère local hex) de l'unité en cours de déplacement le long
// de son chemin, ou null si l'animation est terminée.
function movingUnitPixel(movingUnit, now) {
    const { path, time } = movingUnit;
    const duration = moveAnimDuration(path);
    const elapsed = Math.max(0, now - time);
    if (elapsed >= duration) return null;
    const segments = path.length - 1;
    const pos = (elapsed / duration) * segments;
    const i = Math.min(Math.floor(pos), segments - 1);
    const t = pos - i;
    const a = hexToPixel(path[i].q, path[i].r);
    const b = hexToPixel(path[i + 1].q, path[i + 1].r);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function drawScene(canvas, state, hoveredHex) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = "#f5f0e8";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const validMoveKeys = new Set(state.validMoves.map(hexKey));
    const validTargetKeys = new Set((state.validTargets || []).map(u => hexKey(u.hex)));
    const attackRangeKeys = new Set((state.attackRangeHexes || []).map(hexKey));

    const hexes = [];
    for (let q = -6; q <= 6; q++)
        for (let r = -6; r <= 6; r++) {
            const s = -q - r;
            if (isValidHex({ q, r, s })) hexes.push({ q, r, s });
        }

    const obstacleKeys = new Set((state.obstacles || []).map(hexKey));
    const riverKeys = new Set((state.rivers || []).map(hexKey));
    const townKeys = new Set((state.towns || []).map(hexKey));
    const forestKeys = new Set((state.forests || []).map(hexKey));
    const hillKeys = new Set((state.hills || []).map(hexKey));
    const swampKeys = new Set((state.swamps || []).map(hexKey));
    const townOwnership = state.townOwnership || {};

    hexes.forEach(hex => {
        const { x, y } = hexToPixel(hex.q, hex.r);
        const px = x + OX, py = y + OY;
        const k = hexKey(hex);
        const isObstacle = obstacleKeys.has(k);
        const isRiver = riverKeys.has(k);
        const isTown = townKeys.has(k);
        const isForest = forestKeys.has(k);
        const isHill = hillKeys.has(k);
        const isSwamp = swampKeys.has(k);
        const isMove = validMoveKeys.has(k);
        const isTarget = validTargetKeys.has(k);
        const isAttackRange = !isMove && !isTarget && attackRangeKeys.has(k);
        const isHover = hoveredHex && hexKey(hoveredHex) === k;
        const corners = hexCorners(px, py, HEX_SIZE);

        ctx.beginPath();
        corners.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
        ctx.closePath();

        let fill = "#e8e0d0";
        if (isHill) fill = "#d4c8a0";
        if (isSwamp) fill = "#8aaa78";
        if (isForest) fill = "#b8d4a0";
        if (isRiver) fill = "#a0c8e8";
        if (isTown) {
            const owner = townOwnership[k];
            fill = owner === 1 ? "rgba(42,111,168,0.25)" : owner === 2 ? "rgba(160,48,48,0.25)" : "#e8d8b0";
        }
        if (isObstacle) fill = "#8a7a60";
        if (isAttackRange) fill = "rgba(200,100,50,0.08)";
        if (isMove) fill = isHover ? "rgba(58,128,196,0.35)" : "rgba(58,128,196,0.15)";
        if (isTarget) fill = isHover ? "rgba(200,50,50,0.35)" : "rgba(200,50,50,0.15)";
        ctx.fillStyle = fill;
        ctx.fill();
        const townStroke = isTown ? (townOwnership[k] === 1 ? "#2a6fa8" : townOwnership[k] === 2 ? "#a03030" : "#8a7040") : null;
        ctx.strokeStyle = isTarget ? "#cc3333" : isMove ? "#3a7abf" : isAttackRange ? "#c87030" : isObstacle ? "#6a5a40" : isRiver ? "#5a9abf" : isTown ? townStroke : isForest ? "#5a8a40" : isHill ? "#8a7a40" : isSwamp ? "#5a7a40" : "#c8b898";
        ctx.lineWidth = isTarget || isMove ? 1.5 : isAttackRange ? 1.2 : 0.8;
        ctx.stroke();

        if (isObstacle) {
            ctx.font = `${HEX_SIZE * 0.55}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#4a3a20";
            ctx.fillText("⛰️", px, py);
        }

        if (isRiver) {
            ctx.font = `${HEX_SIZE * 0.45}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#3a7abf";
            ctx.fillText("〰", px, py);
        }

        if (isTown) {
            ctx.font = `${HEX_SIZE * 0.5}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#5a4a20";
            ctx.fillText("🏰", px, py);
        }

        if (isForest) {
            ctx.font = `${HEX_SIZE * 0.5}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#3a6a20";
            ctx.fillText("🌲", px, py);
        }

        if (isHill) {
            ctx.font = `${HEX_SIZE * 0.5}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#6a5a20";
            ctx.fillText("⛰", px, py);
        }

        if (isSwamp) {
            ctx.font = `${HEX_SIZE * 0.5}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#4a6a30";
            ctx.fillText("☠", px, py);
        }
    });

    const now = Date.now();
    const activeShakes = new Map();
    (state.hitEffects || []).forEach(e => {
        const elapsed = now - e.time;
        if (elapsed < HIT_EFFECT_DURATION) activeShakes.set(hexKey(e.hex), elapsed);
    });

    const movingUnit = state.movingUnit;
    const movingPixel = movingUnit ? movingUnitPixel(movingUnit, now) : null;

    state.units.forEach(unit => {
        if (unit.currentWounds <= 0) return;
        const moving = movingPixel && movingUnit.id === unit.id;
        const { x, y } = moving ? movingPixel : hexToPixel(unit.hex.q, unit.hex.r);
        const uk = hexKey(unit.hex);
        const shakeElapsed = activeShakes.get(uk);
        const shakeOx = shakeElapsed !== undefined ? Math.sin(shakeElapsed / 20) * 4 * (1 - shakeElapsed / HIT_EFFECT_DURATION) : 0;
        const px = x + OX + shakeOx, py = y + OY;
        const r = HEX_SIZE * 0.52;
        const isSelected = state.selectedUnit?.id === unit.id;
        const isDimmed = unit.hasMoved && unit.hasAttacked;

        const P1 = { fill: "#d0e4f5", ring: "#2a6fa8" };
        const P2 = { fill: "#f5d0d0", ring: "#a03030" };
        const col = unit.player === 1 ? P1 : P2;

        if (isSelected) {
            ctx.shadowBlur = 24;
            ctx.shadowColor = col.ring;
        }

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = isDimmed ? "#d0d0d0" : col.fill;
        ctx.fill();
        ctx.strokeStyle = isDimmed ? "#aaa" : col.ring;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = `${HEX_SIZE * 0.52}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = isDimmed ? 0.35 : 1;
        ctx.fillStyle = "#2a2015";
        ctx.fillText(unit.symbol, px, py);
        ctx.globalAlpha = 1;

        // HP bar
        const bw = HEX_SIZE * 1.15, bh = 4;
        const bx = px - bw / 2, by = py + r + 4;
        ctx.fillStyle = "#d5cbb8";
        ctx.fillRect(bx, by, bw, bh);
        const ratio = unit.currentWounds / unit.wounds;
        ctx.fillStyle = ratio > 0.5 ? "#4caf50" : ratio > 0.25 ? "#ff9800" : "#e53935";
        ctx.fillRect(bx, by, bw * ratio, bh);

        // Terrain effect indicators (top-right of unit circle)
        const effects = getUnitTerrainEffects(unit, state);
        const iconSize = 10;
        effects.forEach((effect, i) => {
            const ix = px + r - 4 - i * (iconSize + 1);
            const iy = py - r + 4;
            if (effect === "cover" || effect === "river") {
                ctx.beginPath();
                ctx.moveTo(ix, iy - 4);
                ctx.lineTo(ix + 4, iy - 5);
                ctx.lineTo(ix + 4, iy + 1);
                ctx.quadraticCurveTo(ix, iy + 5, ix, iy + 5);
                ctx.quadraticCurveTo(ix, iy + 5, ix - 4, iy + 1);
                ctx.lineTo(ix - 4, iy - 5);
                ctx.closePath();
                ctx.fillStyle = effect === "cover" ? "#4caf50" : "#e53935";
                ctx.fill();
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 0.8;
                ctx.stroke();
            } else if (effect === "hill") {
                ctx.beginPath();
                ctx.arc(ix, iy, 4, 0, Math.PI * 2);
                ctx.fillStyle = "#1e88e5";
                ctx.fill();
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(ix - 3, iy);
                ctx.lineTo(ix + 3, iy);
                ctx.moveTo(ix, iy - 3);
                ctx.lineTo(ix, iy + 3);
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });
    });

    // AI preview indicators
    const aiPreview = state.aiPreview;
    if (aiPreview) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);

        if (aiPreview.type === "select") {
            // Golden pulsing ring around the unit the AI will select
            const unit = state.units.find(u => u.hex.q === aiPreview.hex.q && u.hex.r === aiPreview.hex.r);
            if (unit) {
                const { x, y } = hexToPixel(unit.hex.q, unit.hex.r);
                const px = x + OX, py = y + OY;
                const r = HEX_SIZE * 0.52 + 4;
                ctx.beginPath();
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(180, 150, 30, ${0.5 + pulse * 0.5})`;
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        if (aiPreview.type === "move") {
            // Destination hex: red translucent halo with dashed border
            const { x, y } = hexToPixel(aiPreview.hex.q, aiPreview.hex.r);
            const px = x + OX, py = y + OY;
            const corners = hexCorners(px, py, HEX_SIZE);
            ctx.beginPath();
            corners.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
            ctx.closePath();
            ctx.fillStyle = `rgba(160, 48, 48, ${0.12 + pulse * 0.12})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(160, 48, 48, ${0.5 + pulse * 0.4})`;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([5, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Circle marker in center
            ctx.beginPath();
            ctx.arc(px, py, HEX_SIZE * 0.15, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(160, 48, 48, ${0.6 + pulse * 0.3})`;
            ctx.fill();
        }

        if (aiPreview.type === "attack") {
            // Crosshair on target hex
            const { x, y } = hexToPixel(aiPreview.hex.q, aiPreview.hex.r);
            const px = x + OX, py = y + OY;
            const r = HEX_SIZE * 0.52 + 5;

            // Pulsing red circle
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(220, 40, 40, ${0.5 + pulse * 0.5})`;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Crosshair lines
            const len = HEX_SIZE * 0.3;
            ctx.strokeStyle = `rgba(220, 40, 40, ${0.4 + pulse * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(px - r - len, py); ctx.lineTo(px - r + 4, py);
            ctx.moveTo(px + r + len, py); ctx.lineTo(px + r - 4, py);
            ctx.moveTo(px, py - r - len); ctx.lineTo(px, py - r + 4);
            ctx.moveTo(px, py + r + len); ctx.lineTo(px, py + r - 4);
            ctx.stroke();
        }
    }

    // Dying units animation
    (state.dyingUnits || []).forEach(dying => {
        const elapsed = now - dying.deathTime;
        if (elapsed >= DEATH_ANIM_DURATION) return;
        const progress = elapsed / DEATH_ANIM_DURATION;
        const { x, y } = hexToPixel(dying.hex.q, dying.hex.r);
        const px = x + OX, py = y + OY;
        const scale = 1 - progress;
        const alpha = 1 - progress;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(px, py);
        ctx.scale(scale, scale);

        const r = HEX_SIZE * 0.52;
        const P1 = { fill: "#d0e4f5", ring: "#2a6fa8" };
        const P2 = { fill: "#f5d0d0", ring: "#a03030" };
        const col = dying.player === 1 ? P1 : P2;

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = col.fill;
        ctx.fill();
        ctx.strokeStyle = col.ring;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = `${HEX_SIZE * 0.52}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#2a2015";
        ctx.fillText(dying.symbol, 0, 0);

        ctx.restore();
    });

    // Attack effects: sword slash on target (melee) or bullet from attacker to target (ranged)
    (state.attackEffects || []).forEach(effect => {
        const elapsed = now - effect.time;
        if (elapsed >= ATTACK_EFFECT_DURATION) return;
        const progress = elapsed / ATTACK_EFFECT_DURATION;
        const from = hexToPixel(effect.from.q, effect.from.r);
        const to = hexToPixel(effect.to.q, effect.to.r);

        ctx.save();
        if (effect.weaponType === "melee") {
            // Crescent slash cutting across the target: the arc is revealed
            // quickly in the attack direction, then fades out
            const cx = to.x + OX, cy = to.y + OY;
            const attackDir = Math.atan2(to.y - from.y, to.x - from.x);
            const reveal = Math.min(1, progress / 0.55);
            const fade = progress < 0.55 ? 1 : 1 - (progress - 0.55) / 0.45;
            const sweep = Math.PI * 0.55;
            const start = attackDir - sweep / 2;
            // Arc center pulled back toward the attacker so the blade arc
            // crosses the target instead of orbiting around it
            const ox = cx - Math.cos(attackDir) * HEX_SIZE * 0.5;
            const oy = cy - Math.sin(attackDir) * HEX_SIZE * 0.5;
            const r = HEX_SIZE * 0.95;
            // Tapered crescent: thick in the middle, pointed at both tips,
            // like the trail left by a blade
            const steps = 16;
            ctx.globalAlpha = fade;
            ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const ang = start + sweep * reveal * t;
                const w = Math.sin(Math.PI * t) * HEX_SIZE * 0.22;
                const x = ox + Math.cos(ang) * (r + w / 2);
                const y = oy + Math.sin(ang) * (r + w / 2);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            for (let i = steps; i >= 0; i--) {
                const t = i / steps;
                const ang = start + sweep * reveal * t;
                const w = Math.sin(Math.PI * t) * HEX_SIZE * 0.22;
                ctx.lineTo(ox + Math.cos(ang) * (r - w / 2), oy + Math.sin(ang) * (r - w / 2));
            }
            ctx.closePath();
            ctx.shadowBlur = 8;
            ctx.shadowColor = "rgba(110, 130, 155, 0.9)";
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "#8a97a5";
            ctx.lineWidth = 1.2;
            ctx.stroke();
        } else {
            // Bullet travelling from attacker to target with a short trail
            const bx = from.x + (to.x - from.x) * progress + OX;
            const by = from.y + (to.y - from.y) * progress + OY;
            const dirAngle = Math.atan2(to.y - from.y, to.x - from.x);
            ctx.strokeStyle = "rgba(42, 32, 21, 0.45)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bx - Math.cos(dirAngle) * 14, by - Math.sin(dirAngle) * 14);
            ctx.lineTo(bx, by);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(bx, by, 3, 0, Math.PI * 2);
            ctx.fillStyle = "#2a2015";
            ctx.fill();
        }
        ctx.restore();
    });

    // Hit effects: floating damage text
    (state.hitEffects || []).forEach(effect => {
        const elapsed = now - effect.time;
        if (elapsed >= HIT_EFFECT_DURATION) return;
        const progress = elapsed / HIT_EFFECT_DURATION;
        const { x, y } = hexToPixel(effect.hex.q, effect.hex.r);
        const px = x + OX, py = y + OY - progress * 30;

        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.font = `bold ${14 + (1 - progress) * 4}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "#2a2015";
        ctx.lineWidth = 2.5;
        ctx.strokeText(`-${effect.damage}`, px, py);
        ctx.fillStyle = "#e53935";
        ctx.fillText(`-${effect.damage}`, px, py);
        ctx.restore();
    });
}
