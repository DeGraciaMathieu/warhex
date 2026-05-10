import { HEX_SIZE, hexToPixel, hexKey, isValidHex, hexCorners } from "./hex.js";

export const CANVAS_W = 700;
export const CANVAS_H = 616;
export const OX = CANVAS_W / 2;
export const OY = CANVAS_H / 2;

export function drawScene(canvas, state, hoveredHex) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = "#f5f0e8";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const validMoveKeys = new Set(state.validMoves.map(hexKey));
    const validTargetKeys = new Set((state.validTargets || []).map(u => hexKey(u.hex)));

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
        if (isMove) fill = isHover ? "rgba(58,128,196,0.35)" : "rgba(58,128,196,0.15)";
        if (isTarget) fill = isHover ? "rgba(200,50,50,0.35)" : "rgba(200,50,50,0.15)";
        ctx.fillStyle = fill;
        ctx.fill();
        const townStroke = isTown ? (townOwnership[k] === 1 ? "#2a6fa8" : townOwnership[k] === 2 ? "#a03030" : "#8a7040") : null;
        ctx.strokeStyle = isTarget ? "#cc3333" : isMove ? "#3a7abf" : isObstacle ? "#6a5a40" : isRiver ? "#5a9abf" : isTown ? townStroke : isForest ? "#5a8a40" : isHill ? "#8a7a40" : isSwamp ? "#5a7a40" : "#c8b898";
        ctx.lineWidth = isTarget || isMove ? 1.5 : 0.8;
        ctx.stroke();

        if (isObstacle) {
            ctx.font = `${HEX_SIZE * 0.55}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#4a3a20";
            ctx.fillText("▲", px, py);
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

    state.units.forEach(unit => {
        if (unit.currentWounds <= 0) return;
        const { x, y } = hexToPixel(unit.hex.q, unit.hex.r);
        const px = x + OX, py = y + OY;
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

        // Player dot
        ctx.beginPath();
        ctx.arc(px + r - 4, py - r + 4, 4, 0, Math.PI * 2);
        ctx.fillStyle = unit.player === 1 ? "#2a6fa8" : "#a03030";
        ctx.fill();
    });
}
