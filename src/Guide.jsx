import { useEffect, useRef } from "react";
import { UNIT_TEMPLATES } from "./units.js";
import { hexToPixel, hexCorners } from "./hex.js";

const MINI_HEX = 22;
const P = { 1: "#2a6fa8", 2: "#a03030" };

function miniHexToPixel(q, r) {
    return {
        x: MINI_HEX * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
        y: MINI_HEX * (1.5 * r),
    };
}

function miniCorners(cx, cy) {
    return Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i - 30);
        return { x: cx + MINI_HEX * Math.cos(angle), y: cy + MINI_HEX * Math.sin(angle) };
    });
}

function drawMiniHex(ctx, cx, cy, fill, stroke, symbol, annotation) {
    const corners = miniCorners(cx, cy);
    ctx.beginPath();
    corners.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (symbol) {
        ctx.font = `${MINI_HEX * 0.55}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#2a2015";
        ctx.fillText(symbol, cx, cy);
    }
    if (annotation) {
        ctx.font = "bold 9px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = annotation.color || "#8a6a08";
        ctx.fillText(annotation.text, cx, cy + MINI_HEX + 10);
    }
}

function drawUnit(ctx, cx, cy, player, symbol) {
    const r = MINI_HEX * 0.48;
    const col = player === 1 ? { fill: "#d0e4f5", ring: "#2a6fa8" } : { fill: "#f5d0d0", ring: "#a03030" };
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = col.fill;
    ctx.fill();
    ctx.strokeStyle = col.ring;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = `${MINI_HEX * 0.5}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#2a2015";
    ctx.fillText(symbol, cx, cy);
}

function drawDashedLine(ctx, x1, y1, x2, y2, color) {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}

function drawCross(ctx, cx, cy, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 5);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.moveTo(cx + 5, cy - 5);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.stroke();
}

function MiniCanvas({ width, height, draw }) {
    const ref = useRef(null);
    useEffect(() => {
        const ctx = ref.current.getContext("2d");
        ctx.clearRect(0, 0, width, height);
        draw(ctx);
    }, []);
    return <canvas ref={ref} width={width} height={height} style={{ display: "block", flexShrink: 0, minWidth: width }} />;
}

function SceneObstacleMove() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isObs = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isObs ? "#8a7a60" : "#e8e0d0",
                    isObs ? "#6a5a40" : "#c8b898",
                    isObs ? "▲" : null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "⚔");
            const obsPos = miniHexToPixel(0, 0);
            drawDashedLine(ctx, p1.x + ox + 12, p1.y + oy, obsPos.x + ox - 12, obsPos.y + oy, "#e53935");
            drawCross(ctx, obsPos.x + ox, obsPos.y + oy + MINI_HEX + 8, "#e53935");
        }} />
    );
}

function SceneLosBlocked() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isObs = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isObs ? "#8a7a60" : "#e8e0d0",
                    isObs ? "#6a5a40" : "#c8b898",
                    isObs ? "▲" : null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            const p2 = miniHexToPixel(2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "⚔");
            drawUnit(ctx, p2.x + ox, p2.y + oy, 2, "⚔");
            const mid = miniHexToPixel(0, 0);
            drawDashedLine(ctx, p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy, "#e53935");
            drawCross(ctx, mid.x + ox, mid.y + oy - 14, "#e53935");
        }} />
    );
}

function SceneForestLos() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isForest = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isForest ? "#b8d4a0" : "#e8e0d0",
                    isForest ? "#5a8a40" : "#c8b898",
                    isForest ? "🌲" : null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            const p2 = miniHexToPixel(2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "🎯");
            drawUnit(ctx, p2.x + ox, p2.y + oy, 2, "⚔");
            const mid = miniHexToPixel(0, 0);
            drawDashedLine(ctx, p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy, "#e53935");
            drawCross(ctx, mid.x + ox, mid.y + oy - 14, "#e53935");
        }} />
    );
}

function SceneForestCost() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isForest = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isForest ? "#b8d4a0" : "#e8e0d0",
                    isForest ? "#5a8a40" : "#c8b898",
                    isForest ? "🌲" : null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "⚔");
            const forestPos = miniHexToPixel(0, 0);
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#2a6fa8";
            ctx.fillText("×2", forestPos.x + ox, forestPos.y + oy + MINI_HEX + 8);
            drawDashedLine(ctx, p1.x + ox + 12, p1.y + oy, forestPos.x + ox, forestPos.y + oy, "#2a6fa8");
        }} />
    );
}

function SceneForestCover() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isForest = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isForest ? "#b8d4a0" : "#e8e0d0",
                    isForest ? "#5a8a40" : "#c8b898",
                    isForest ? "🌲" : null
                );
            });
            const forestPos = miniHexToPixel(0, 0);
            drawUnit(ctx, forestPos.x + ox, forestPos.y + oy, 2, "⚔");
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#2e7d32";
            ctx.fillText("🛡 -1 save", forestPos.x + ox, forestPos.y + oy + MINI_HEX + 8);
            const attPos = miniHexToPixel(-1, 0);
            drawUnit(ctx, attPos.x + ox, attPos.y + oy, 1, "🎯");
            drawDashedLine(ctx, attPos.x + ox + 12, attPos.y + oy, forestPos.x + ox - 12, forestPos.y + oy, "#2a6fa8");
        }} />
    );
}

function SceneForestShoot() {
    return (
        <MiniCanvas width={280} height={110} draw={(ctx) => {
            const ox = 100, oy = 50;
            const hexes = [
                { q: -2, r: 0 }, { q: -2, r: 1 },
                { q: -1, r: 0 }, { q: -1, r: 1 },
                { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
            ];
            const forestHexes = [{ q: -2, r: 0 }, { q: -2, r: 1 }, { q: -1, r: 0 }, { q: -1, r: 1 }];
            const forestSet = new Set(forestHexes.map(h => `${h.q},${h.r}`));
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isForest = forestSet.has(`${h.q},${h.r}`);
                drawMiniHex(ctx, x + ox, y + oy,
                    isForest ? "#b8d4a0" : "#e8e0d0",
                    isForest ? "#5a8a40" : "#c8b898",
                    isForest && !(h.q === -1 && h.r === 0) ? "🌲" : null
                );
            });
            const sniper = miniHexToPixel(-1, 0);
            const target = miniHexToPixel(2, 0);
            drawUnit(ctx, sniper.x + ox, sniper.y + oy, 1, "🎯");
            drawUnit(ctx, target.x + ox, target.y + oy, 2, "⚔");
            drawDashedLine(ctx, sniper.x + ox + 12, sniper.y + oy, target.x + ox - 12, target.y + oy, "#4caf50");
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#2e7d32";
            ctx.fillText("✓ tir depuis forêt", ox, oy + 45);
        }} />
    );
}

function SceneRiverLos() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isRiver = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isRiver ? "#a0c8e8" : "#e8e0d0",
                    isRiver ? "#5a9abf" : "#c8b898",
                    isRiver ? "〰" : null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            const p2 = miniHexToPixel(2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "🎯");
            drawUnit(ctx, p2.x + ox, p2.y + oy, 2, "⚔");
            drawDashedLine(ctx, p1.x + ox + 12, p1.y + oy, p2.x + ox - 12, p2.y + oy, "#4caf50");
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#2e7d32";
            const mid = miniHexToPixel(0, 0);
            ctx.fillText("✓ LOS", mid.x + ox, mid.y + oy + MINI_HEX + 8);
        }} />
    );
}

function SceneRiverCost() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isRiver = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isRiver ? "#a0c8e8" : "#e8e0d0",
                    isRiver ? "#5a9abf" : "#c8b898",
                    isRiver ? "〰" : null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "⚔");
            const riverPos = miniHexToPixel(0, 0);
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#2a6fa8";
            ctx.fillText("STOP", riverPos.x + ox, riverPos.y + oy + MINI_HEX + 8);
            drawDashedLine(ctx, p1.x + ox + 12, p1.y + oy, riverPos.x + ox, riverPos.y + oy, "#2a6fa8");
        }} />
    );
}

function SceneTownStop() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isTown = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isTown ? "#d4c4a0" : "#e8e0d0",
                    isTown ? "#8a7040" : "#c8b898",
                    null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "⚔");
            const townPos = miniHexToPixel(0, 0);
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#a03030";
            ctx.fillText("STOP", townPos.x + ox, townPos.y + oy + MINI_HEX + 8);
            drawDashedLine(ctx, p1.x + ox + 12, p1.y + oy, townPos.x + ox, townPos.y + oy, "#8a7a60");
        }} />
    );
}

function SceneTownLos() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isTown = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isTown ? "#d4c4a0" : "#e8e0d0",
                    isTown ? "#8a7040" : "#c8b898",
                    null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            const p2 = miniHexToPixel(2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "🎯");
            drawUnit(ctx, p2.x + ox, p2.y + oy, 2, "⚔");
            const mid = miniHexToPixel(0, 0);
            drawDashedLine(ctx, p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy, "#e53935");
            drawCross(ctx, mid.x + ox, mid.y + oy - 14, "#e53935");
        }} />
    );
}

function SceneTownCover() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isTown = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isTown ? "#d4c4a0" : "#e8e0d0",
                    isTown ? "#8a7040" : "#c8b898",
                    null
                );
            });
            const townPos = miniHexToPixel(0, 0);
            drawUnit(ctx, townPos.x + ox, townPos.y + oy, 2, "⚔");
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#2e7d32";
            ctx.fillText("🛡 -1 save", townPos.x + ox, townPos.y + oy + MINI_HEX + 8);
            const attPos = miniHexToPixel(-1, 0);
            drawUnit(ctx, attPos.x + ox, attPos.y + oy, 1, "🎯");
            drawDashedLine(ctx, attPos.x + ox + 12, attPos.y + oy, townPos.x + ox - 12, townPos.y + oy, "#2a6fa8");
        }} />
    );
}

function SceneHillCost() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isHill = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isHill ? "#d4c8a0" : "#e8e0d0",
                    isHill ? "#8a7a40" : "#c8b898",
                    null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "⚔");
            const hillPos = miniHexToPixel(0, 0);
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#2a6fa8";
            ctx.fillText("×2", hillPos.x + ox, hillPos.y + oy + MINI_HEX + 8);
            drawDashedLine(ctx, p1.x + ox + 12, p1.y + oy, hillPos.x + ox, hillPos.y + oy, "#2a6fa8");
        }} />
    );
}

function SceneHillLos() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isHill = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isHill ? "#d4c8a0" : "#e8e0d0",
                    isHill ? "#8a7a40" : "#c8b898",
                    null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            const p2 = miniHexToPixel(2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "🎯");
            drawUnit(ctx, p2.x + ox, p2.y + oy, 2, "⚔");
            drawDashedLine(ctx, p1.x + ox + 12, p1.y + oy, p2.x + ox - 12, p2.y + oy, "#4caf50");
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#2e7d32";
            const mid = miniHexToPixel(0, 0);
            ctx.fillText("✓ LOS", mid.x + ox, mid.y + oy + MINI_HEX + 8);
        }} />
    );
}

function SceneHillRange() {
    return (
        <MiniCanvas width={240} height={80} draw={(ctx) => {
            const ox = 80, oy = 40;
            const hexes = [{ q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isHill = h.q === -1;
                drawMiniHex(ctx, x + ox, y + oy,
                    isHill ? "#d4c8a0" : "#e8e0d0",
                    isHill ? "#8a7a40" : "#c8b898",
                    null
                );
            });
            const hillPos = miniHexToPixel(-1, 0);
            drawUnit(ctx, hillPos.x + ox, hillPos.y + oy, 1, "🎯");
            const targetPos = miniHexToPixel(3, 0);
            drawUnit(ctx, targetPos.x + ox, targetPos.y + oy, 2, "⚔");
            drawDashedLine(ctx, hillPos.x + ox + 12, hillPos.y + oy, targetPos.x + ox - 12, targetPos.y + oy, "#4caf50");
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#2e7d32";
            ctx.fillText("⛰ +1 portée", hillPos.x + ox, hillPos.y + oy + MINI_HEX + 8);
        }} />
    );
}

function SceneSwampPoison() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isSwamp = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isSwamp ? "#8aaa78" : "#e8e0d0",
                    isSwamp ? "#5a7a40" : "#c8b898",
                    isSwamp ? "☠" : null
                );
            });
            const swampPos = miniHexToPixel(0, 0);
            drawUnit(ctx, swampPos.x + ox, swampPos.y + oy, 1, "⚔");
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#a03030";
            ctx.fillText("-1 PV", swampPos.x + ox, swampPos.y + oy + MINI_HEX + 8);
        }} />
    );
}

function SceneSwampStop() {
    return (
        <MiniCanvas width={200} height={80} draw={(ctx) => {
            const ox = 100, oy = 40;
            const hexes = [{ q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isSwamp = h.q === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isSwamp ? "#8aaa78" : "#e8e0d0",
                    isSwamp ? "#5a7a40" : "#c8b898",
                    isSwamp ? "☠" : null
                );
            });
            const p1 = miniHexToPixel(-2, 0);
            drawUnit(ctx, p1.x + ox, p1.y + oy, 1, "🐴");
            const swampPos = miniHexToPixel(0, 0);
            ctx.font = "bold 10px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#a03030";
            ctx.fillText("STOP", swampPos.x + ox, swampPos.y + oy + MINI_HEX + 8);
            drawDashedLine(ctx, p1.x + ox + 12, p1.y + oy, swampPos.x + ox, swampPos.y + oy, "#8a7a60");
        }} />
    );
}

function SceneTownControl() {
    return (
        <MiniCanvas width={200} height={100} draw={(ctx) => {
            const ox = 100, oy = 45;
            const hexes = [
                { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 },
                { q: 0, r: -1 }, { q: 0, r: 1 },
            ];
            hexes.forEach(h => {
                const { x, y } = miniHexToPixel(h.q, h.r);
                const isTown = h.q === 0 && h.r === 0;
                drawMiniHex(ctx, x + ox, y + oy,
                    isTown ? "#d4c4a0" : "#e8e0d0",
                    isTown ? "#8a7040" : "#c8b898",
                    null
                );
            });
            const townPos = miniHexToPixel(0, 0);
            drawUnit(ctx, townPos.x + ox, townPos.y + oy, 1, "⚔");
            ctx.font = "bold 9px 'Cinzel', serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#8a6a08";
            ctx.fillText("🏰 +1 point", townPos.x + ox, townPos.y + oy + MINI_HEX + 10);
        }} />
    );
}

function IndicatorIcon({ type }) {
    const ref = useRef(null);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, 20, 20);
        const cx = 10, cy = 10;
        if (type === "cover" || type === "river") {
            ctx.beginPath();
            ctx.moveTo(cx, cy - 5);
            ctx.lineTo(cx + 5, cy - 6);
            ctx.lineTo(cx + 5, cy + 1);
            ctx.quadraticCurveTo(cx, cy + 6, cx, cy + 6);
            ctx.quadraticCurveTo(cx, cy + 6, cx - 5, cy + 1);
            ctx.lineTo(cx - 5, cy - 6);
            ctx.closePath();
            ctx.fillStyle = type === "cover" ? "#4caf50" : "#e53935";
            ctx.fill();
        } else if (type === "hill") {
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.strokeStyle = "#1e88e5";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy);
            ctx.lineTo(cx + 5, cy);
            ctx.moveTo(cx, cy - 5);
            ctx.lineTo(cx, cy + 5);
            ctx.strokeStyle = "#1e88e5";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }, [type]);
    return <canvas ref={ref} width={20} height={20} style={{ display: "inline-block", verticalAlign: "middle" }} />;
}

const SECTION_STYLE = {
    background: "#ece5d8", border: "1px solid #d5cbb8", borderRadius: 4, padding: 16, marginBottom: 16,
};
const TITLE_STYLE = {
    fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700, letterSpacing: ".12em", color: "#8a6a08", marginBottom: 10,
};
const TEXT_STYLE = { fontSize: 13, lineHeight: 1.6, color: "#2a2015" };

const NAV_ITEMS = [
    { id: "objectif", label: "Objectif" },
    { id: "unites", label: "Unités" },
    { id: "combat", label: "Combat" },
    { id: "terrains", label: "Terrains" },
];

const TERRAIN_CELL = { padding: "6px 10px", fontSize: 12, borderBottom: "1px solid #d5cbb8", textAlign: "center" };
const TERRAIN_HEADER = { ...TERRAIN_CELL, fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".1em", color: "#8a7a60", fontWeight: 700, background: "#e5ddd0" };

const TERRAIN_SECTION = {
    background: "#f5f0e8", border: "1px solid #d5cbb8", borderRadius: 4, padding: 14, marginBottom: 10,
};

export default function Guide({ onBack }) {
    const unitTypes = Object.entries(UNIT_TEMPLATES);

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "#f5f0e8", color: "#2a2015", fontFamily: "'Crimson Text', Georgia, serif", padding: "30px 20px" }}>
            <div style={{ maxWidth: 680, width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 700, letterSpacing: ".2em", color: "#8a6a08" }}>
                        GUIDE DE JEU
                    </div>
                    <button className="btn btn-grey" onClick={onBack} style={{ width: "auto", padding: "6px 16px" }}>
                        Retour
                    </button>
                </div>

                <div style={{ ...SECTION_STYLE, display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 16px" }}>
                    {NAV_ITEMS.map(item => (
                        <button key={item.id} onClick={() => scrollTo(item.id)} style={{
                            background: "none", border: "1px solid #c8b898", borderRadius: 3, padding: "4px 14px",
                            fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: ".1em", color: "#8a6a08",
                            cursor: "pointer",
                        }}>
                            {item.label}
                        </button>
                    ))}
                </div>

                <div id="objectif" style={SECTION_STYLE}>
                    <div style={TITLE_STYLE}>OBJECTIF</div>
                    <div style={TEXT_STYLE}>
                        <p style={{ margin: "0 0 8px" }}>Warhex est un jeu tactique au tour par tour sur grille hexagonale. Deux joueurs s'affrontent pendant <strong>7 tours</strong>.</p>
                        <p style={{ margin: "0 0 8px" }}>Chaque tour, vous activez <strong>deux unités</strong> (une à la fois) : déplacement et/ou attaque pour chacune, puis le tour passe automatiquement à l'adversaire.</p>
                        <p style={{ margin: "0 0 8px" }}>Les <strong>villes</strong> (🏰) rapportent des points : quand une unité se déplace sur une ville, celle-ci devient la propriété de son joueur (la case change de couleur). La ville reste au joueur tant qu'un adversaire ne s'y déplace pas. Chaque ville possédée rapporte <strong>1 point</strong> en fin de tour. Après 7 tours, le joueur avec le plus de points gagne.</p>
                    </div>
                    <SceneTownControl />
                </div>

                <div id="unites" style={SECTION_STYLE}>
                    <div style={TITLE_STYLE}>UNITÉS</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {unitTypes.map(([key, t]) => (
                            <div key={key} style={{ background: "#f5f0e8", border: "1px solid #d5cbb8", borderRadius: 3, padding: 12 }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: "#2a2015", marginBottom: 6 }}>
                                    {t.symbol} {t.name}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0 20px", fontSize: 12, color: "#6a5a40", marginBottom: 8 }}>
                                    <span>Mouvement : <strong>{t.movement}</strong></span>
                                    <span>PV : <strong>{t.wounds}</strong></span>
                                    <span>Sauvegarde : <strong>{t.save}+</strong></span>
                                    <span>CC : <strong>{t.weaponSkill}+</strong></span>
                                    <span>CT : <strong>{t.ballisticSkill}+</strong></span>
                                </div>
                                <div style={{ fontSize: 12, color: "#6a5a40" }}>
                                    {t.weapons.map(w => (
                                        <div key={w.id} style={{ marginBottom: 2 }}>
                                            {w.type === "ranged" ? "🏹" : "🗡"} <strong>{w.name}</strong> — {w.type === "ranged" ? `Portée ${w.range}` : "Mêlée"} · {w.attacks} att. · {w.damage} dég. · PA {Math.abs(w.ap)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div id="combat" style={SECTION_STYLE}>
                    <div style={TITLE_STYLE}>COMBAT</div>
                    <div style={TEXT_STYLE}>
                        <p style={{ margin: "0 0 6px" }}><strong>1. To Hit</strong> — Lancez autant de D6 que l'arme a d'attaques. Chaque dé supérieur ou égal à la compétence (CC au corps à corps, CT à distance) est une touche.</p>
                        <p style={{ margin: "0 0 6px" }}><strong>2. Sauvegarde</strong> — Le défenseur lance 3 D6. Chaque dé supérieur ou égal à (sauvegarde + |PA|) annule une touche. Si le seuil dépasse 6, la sauvegarde est impossible.</p>
                        <p style={{ margin: 0 }}><strong>3. Dégâts</strong> — Chaque touche non sauvée inflige les dégâts de l'arme.</p>
                    </div>
                </div>

                <div id="terrains" style={SECTION_STYLE}>
                    <div style={TITLE_STYLE}>TERRAINS — RÉCAPITULATIF</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #d5cbb8", borderRadius: 3, fontSize: 12 }}>
                        <thead>
                            <tr>
                                <td style={TERRAIN_HEADER}>Terrain</td>
                                <td style={TERRAIN_HEADER}>Mouvement</td>
                                <td style={TERRAIN_HEADER}>LOS</td>
                                <td style={TERRAIN_HEADER}>Combat</td>
                                <td style={TERRAIN_HEADER}>Indicateur</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ ...TERRAIN_CELL, fontWeight: 600, textAlign: "left" }}>▲ Obstacles</td>
                                <td style={TERRAIN_CELL}>Bloqué</td>
                                <td style={TERRAIN_CELL}>Bloquée</td>
                                <td style={TERRAIN_CELL}>—</td>
                                <td style={TERRAIN_CELL}>—</td>
                            </tr>
                            <tr>
                                <td style={{ ...TERRAIN_CELL, fontWeight: 600, textAlign: "left" }}>〰 Rivières</td>
                                <td style={TERRAIN_CELL}>Stop</td>
                                <td style={TERRAIN_CELL}>Libre</td>
                                <td style={{ ...TERRAIN_CELL, color: "#e53935" }}>+1 save</td>
                                <td style={TERRAIN_CELL}><IndicatorIcon type="river" /></td>
                            </tr>
                            <tr>
                                <td style={{ ...TERRAIN_CELL, fontWeight: 600, textAlign: "left" }}>🏰 Villes</td>
                                <td style={TERRAIN_CELL}>Stop</td>
                                <td style={TERRAIN_CELL}>Bloquée</td>
                                <td style={{ ...TERRAIN_CELL, color: "#4caf50" }}>−1 save</td>
                                <td style={TERRAIN_CELL}><IndicatorIcon type="cover" /></td>
                            </tr>
                            <tr>
                                <td style={{ ...TERRAIN_CELL, fontWeight: 600, textAlign: "left" }}>🌲 Forêts</td>
                                <td style={TERRAIN_CELL}>Coût ×2</td>
                                <td style={TERRAIN_CELL}>Bloquée*</td>
                                <td style={{ ...TERRAIN_CELL, color: "#4caf50" }}>−1 save</td>
                                <td style={TERRAIN_CELL}><IndicatorIcon type="cover" /></td>
                            </tr>
                            <tr>
                                <td style={{ ...TERRAIN_CELL, fontWeight: 600, textAlign: "left" }}>⛰ Collines</td>
                                <td style={TERRAIN_CELL}>Coût ×2</td>
                                <td style={TERRAIN_CELL}>Libre</td>
                                <td style={{ ...TERRAIN_CELL, color: "#1e88e5" }}>+1 portée</td>
                                <td style={TERRAIN_CELL}><IndicatorIcon type="hill" /></td>
                            </tr>
                            <tr>
                                <td style={{ ...TERRAIN_CELL, fontWeight: 600, textAlign: "left", borderBottom: "none" }}>☠ Marais</td>
                                <td style={{ ...TERRAIN_CELL, borderBottom: "none" }}>Stop</td>
                                <td style={{ ...TERRAIN_CELL, borderBottom: "none" }}>Libre</td>
                                <td style={{ ...TERRAIN_CELL, borderBottom: "none", color: "#e53935" }}>−1 PV</td>
                                <td style={{ ...TERRAIN_CELL, borderBottom: "none" }}>—</td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{ fontSize: 11, color: "#8a7a60", marginTop: 6 }}>* On peut tirer depuis ou vers une forêt, mais pas à travers.</div>
                </div>

                <div style={TERRAIN_SECTION}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>▲ Obstacles</div>
                    <div style={TEXT_STYLE}>Infranchissables. Bloquent la ligne de vue.</div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                        <SceneObstacleMove />
                        <SceneLosBlocked />
                    </div>
                </div>

                <div style={TERRAIN_SECTION}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>〰 Rivières</div>
                    <div style={TEXT_STYLE}>L'unité s'arrête immédiatement en entrant. Malus défensif : +1 au seuil de sauvegarde. Ne bloque pas la ligne de vue.</div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                        <SceneRiverCost />
                        <SceneRiverLos />
                    </div>
                </div>

                <div style={TERRAIN_SECTION}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🏰 Villes</div>
                    <div style={TEXT_STYLE}>L'unité s'arrête immédiatement en entrant. Chaque ville possédée rapporte 1 point en fin de tour. Bonus de couvert (−1 au seuil de sauvegarde). Bloquent la ligne de vue.</div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                        <SceneTownStop />
                        <SceneTownControl />
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                        <SceneTownCover />
                        <SceneTownLos />
                    </div>
                </div>

                <div style={TERRAIN_SECTION}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🌲 Forêts</div>
                    <div style={TEXT_STYLE}>Coûtent 2 points de mouvement. Bonus de couvert (−1 au seuil de sauvegarde). Bloquent la LOS entre deux cases, mais on peut tirer depuis ou vers une forêt.</div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                        <SceneForestCost />
                        <SceneForestCover />
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                        <SceneForestLos />
                        <SceneForestShoot />
                    </div>
                </div>

                <div style={TERRAIN_SECTION}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>⛰ Collines</div>
                    <div style={TEXT_STYLE}>Coûtent 2 points de mouvement. Ne bloquent pas la ligne de vue. Les unités à distance gagnent +1 de portée.</div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                        <SceneHillCost />
                        <SceneHillLos />
                        <SceneHillRange />
                    </div>
                </div>

                <div style={TERRAIN_SECTION}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>☠ Marais</div>
                    <div style={TEXT_STYLE}>L'unité s'arrête immédiatement en entrant. Inflige 1 dégât à l'unité qui entre.</div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                        <SceneSwampStop />
                        <SceneSwampPoison />
                    </div>
                </div>

                <div style={{ textAlign: "center", marginTop: 8, marginBottom: 20 }}>
                    <button className="btn btn-grey" onClick={onBack} style={{ width: "auto", padding: "6px 16px" }}>
                        Retour
                    </button>
                </div>
            </div>
        </div>
    );
}
