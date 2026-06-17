import { Fragment, useEffect, useRef, useState } from "react";
import { UNIT_TEMPLATES, ROUNDS_PER_GAME, ACTIVATIONS_PER_TURN, turnSchedule } from "./units.js";

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

const TABS = [
    { id: "objectif", label: "Objectif" },
    { id: "tour", label: "Tour & activation" },
    { id: "unites", label: "Unités" },
    { id: "combat", label: "Combat" },
    { id: "los", label: "Ligne de vue" },
    { id: "terrains", label: "Terrains" },
];

const TERRAIN_CELL = { padding: "8px 10px", fontSize: 12, borderBottom: "1px solid #ddd2bf", textAlign: "center", color: "#3a3020" };
const TERRAIN_HEADER = { ...TERRAIN_CELL, fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".1em", color: "#8a7a60", fontWeight: 700, background: "#e5ddd0" };

function Scene({ children }) {
    return <div className="guide-scene">{children}</div>;
}

function ObjectifTab() {
    return (
        <div className="guide-section">
            <div className="guide-section-title">OBJECTIF</div>
            <div className="guide-text">
                <p>Warhex est un jeu tactique au tour par tour sur grille hexagonale. Deux joueurs s'affrontent pendant <strong>{ROUNDS_PER_GAME} rounds</strong>.</p>
            </div>
            <div className="guide-callout">
                Les <strong>villes</strong> (🏰) rapportent des points. Quand une unité s'y déplace, la ville devient la propriété de son joueur (la case change de couleur) et le reste tant qu'un adversaire ne s'y déplace pas. Chaque ville possédée rapporte <strong>1 point</strong> en fin de round.
            </div>
            <div className="guide-text">
                <p>Après {ROUNDS_PER_GAME} rounds, le joueur avec le plus de points l'emporte.</p>
            </div>
            <div className="guide-scenes"><Scene><SceneTownControl /></Scene></div>
        </div>
    );
}

function TourTab() {
    const schedule = turnSchedule();
    return (
        <div className="guide-section">
            <div className="guide-section-title">TOUR & ACTIVATION</div>
            <div className="guide-text">
                <p>Un <strong>round</strong> comporte un demi-tour par joueur. Le joueur 1 ouvre le round 1, puis le joueur qui commence <strong>alterne à chaque round</strong> pour l'équité — personne ne joue toujours en dernier.</p>
            </div>
            <div className="guide-callout">
                <div className="guide-subsection-title" style={{ marginBottom: 8 }}>Ordre des demi-tours sur la partie</div>
                <div className="guide-badges">
                    {schedule.map((t, i) => (
                        <Fragment key={i}>
                            {i > 0 && schedule[i - 1].round !== t.round && <span className="guide-badge-sep" />}
                            <span className="guide-badge" style={{ background: P[t.player] }}>{t.player}</span>
                        </Fragment>
                    ))}
                </div>
            </div>
            <div className="guide-text">
                <p>À son demi-tour, le joueur actif <strong>active {ACTIVATIONS_PER_TURN} unités</strong>, une à la fois.</p>
                <p>Chaque activation se déroule en deux temps : <strong>déplacement</strong> (selon la valeur de mouvement de l'unité) puis <strong>attaque</strong> optionnelle. Une fois l'action engagée, elle ne s'annule pas.</p>
                <p>Quand les deux joueurs ont joué leur demi-tour, le round se termine : on compte alors les villes possédées (1 point chacune).</p>
            </div>
        </div>
    );
}

function UnitesTab() {
    const unitTypes = Object.entries(UNIT_TEMPLATES);
    const STATS = (t) => [
        { label: "MVT", value: t.movement },
        { label: "PV", value: t.wounds },
        { label: "SVG", value: `${t.save}+` },
        { label: "CC", value: `${t.weaponSkill}+` },
        { label: "CT", value: `${t.ballisticSkill}+` },
    ];
    return (
        <div className="guide-section">
            <div className="guide-section-title">UNITÉS</div>
            <div className="guide-units">
                {unitTypes.map(([key, t]) => (
                    <div key={key} className="guide-unit">
                        <div className="guide-unit-head">
                            <div className="combat-medallion guide-unit-medallion">{t.symbol}</div>
                            <div className="guide-unit-name">{t.name}</div>
                        </div>
                        <div className="weapon-stats" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                            {STATS(t).map(s => (
                                <div key={s.label} className="weapon-stat">
                                    <div className="weapon-stat-label">{s.label}</div>
                                    <div className="weapon-stat-value">{s.value}</div>
                                </div>
                            ))}
                        </div>
                        <div className="guide-unit-weapons">
                            {t.weapons.map(w => (
                                <div key={w.id} className="guide-weapon">
                                    <span>{w.type === "ranged" ? "🏹" : "🗡"}</span>
                                    <span className="guide-weapon-name">{w.name}</span>
                                    <span className="combat-weapon-chip">{w.type === "ranged" ? `Portée ${w.minRange ? `${w.minRange}-` : ""}${w.range}` : "Mêlée"}</span>
                                    <span className="combat-weapon-chip">{w.attacks} att.</span>
                                    <span className="combat-weapon-chip">{w.damage} dég.</span>
                                    <span className="combat-weapon-chip">PA {Math.abs(w.ap)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const COMBAT_STEPS = [
    { title: "To Hit", body: "Lancez autant de D6 que l'arme a d'attaques. Chaque dé supérieur ou égal à la compétence (CC au corps à corps, CT à distance) est une touche." },
    { title: "Sauvegarde", body: "Le défenseur lance 3 D6. Chaque dé supérieur ou égal à (sauvegarde + |PA|) annule une touche. Si le seuil dépasse 6, la sauvegarde est impossible." },
    { title: "Dégâts", body: "Chaque touche non sauvée inflige les dégâts de l'arme." },
    { title: "Consolidation", body: "Si une unité tue un ennemi adjacent au corps à corps, elle peut prendre la place de l'unité éliminée. Les effets du terrain d'arrivée s'appliquent (capture de ville, poison du marais)." },
];

function CombatTab() {
    return (
        <div className="guide-section">
            <div className="guide-section-title">COMBAT</div>
            <div className="guide-steps">
                {COMBAT_STEPS.map((s, i) => (
                    <div key={s.title} className="guide-step">
                        <div className="guide-step-num">{i + 1}</div>
                        <div className="guide-step-body"><strong>{s.title}</strong> — {s.body}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LosTab() {
    return (
        <div className="guide-section">
            <div className="guide-section-title">LIGNE DE VUE</div>
            <div className="guide-text">
                <p>Pour tirer sur une cible, l'unité doit avoir une <strong>ligne de vue</strong> (LOS) dégagée jusqu'à elle.</p>
            </div>
            <div className="guide-callout">
                <strong>Bloquent</strong> la ligne de vue : obstacles (▲), villes (🏰), forêts (🌲).<br />
                <strong>Ne la bloquent pas</strong> : rivières (〰), collines (⛰), marais (☠).
            </div>
            <div className="guide-text">
                <p>Certaines armes ont une <strong>portée minimale</strong> : elles ne peuvent pas tirer sur une cible trop proche.</p>
                <p>Cas de la forêt : on peut tirer <strong>depuis</strong> ou <strong>vers</strong> une forêt, mais pas <strong>à travers</strong>.</p>
            </div>

            <div className="guide-subsection">
                <div className="guide-subsection-title">Obstacles, villes et forêts bloquent</div>
                <div className="guide-scenes">
                    <Scene><SceneLosBlocked /></Scene>
                    <Scene><SceneTownLos /></Scene>
                    <Scene><SceneForestLos /></Scene>
                </div>
            </div>

            <div className="guide-subsection">
                <div className="guide-subsection-title">Rivières et collines laissent passer</div>
                <div className="guide-scenes">
                    <Scene><SceneRiverLos /></Scene>
                    <Scene><SceneHillLos /></Scene>
                </div>
            </div>

            <div className="guide-subsection">
                <div className="guide-subsection-title">Tir depuis une forêt</div>
                <div className="guide-scenes">
                    <Scene><SceneForestShoot /></Scene>
                </div>
            </div>
        </div>
    );
}

const TERRAIN_ROWS = [
    { name: "▲ Obstacles", move: "Bloqué", los: "Bloquée", combat: "—", combatColor: null, indicator: null },
    { name: "〰 Rivières", move: "Stop", los: "Libre", combat: "+1 save", combatColor: "#e53935", indicator: "river" },
    { name: "🏰 Villes", move: "Stop", los: "Bloquée", combat: "−1 save", combatColor: "#4caf50", indicator: "cover" },
    { name: "🌲 Forêts", move: "Coût ×2", los: "Bloquée*", combat: "−1 save", combatColor: "#4caf50", indicator: "cover" },
    { name: "⛰ Collines", move: "Coût ×2", los: "Libre", combat: "+1 portée", combatColor: "#1e88e5", indicator: "hill" },
    { name: "☠ Marais", move: "Stop", los: "Libre", combat: "−1 PV", combatColor: "#e53935", indicator: null },
];

const TERRAIN_DETAILS = [
    { title: "▲ Obstacles", text: "Infranchissables. Bloquent la ligne de vue.", scene: SceneObstacleMove },
    { title: "〰 Rivières", text: "L'unité s'arrête immédiatement en entrant. Malus défensif : +1 au seuil de sauvegarde. Ne bloque pas la ligne de vue.", scene: SceneRiverCost },
    { title: "🏰 Villes", text: "L'unité s'arrête immédiatement en entrant. Chaque ville possédée rapporte 1 point en fin de round. Bonus de couvert (−1 au seuil de sauvegarde). Bloquent la ligne de vue.", scene: SceneTownStop },
    { title: "🌲 Forêts", text: "Coûtent 2 points de mouvement. Bonus de couvert (−1 au seuil de sauvegarde). Bloquent la ligne de vue.", scene: SceneForestCost },
    { title: "⛰ Collines", text: "Coûtent 2 points de mouvement. Ne bloquent pas la ligne de vue. Les unités à distance gagnent +1 de portée.", scene: SceneHillRange },
    { title: "☠ Marais", text: "L'unité s'arrête immédiatement en entrant. Inflige 1 dégât à l'unité qui entre.", scene: SceneSwampPoison },
];

function TerrainsTab() {
    return (
        <div className="guide-section">
            <div className="guide-section-title">TERRAINS — RÉCAPITULATIF</div>
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd2bf", borderRadius: 3, fontSize: 12, overflow: "hidden" }}>
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
                    {TERRAIN_ROWS.map((row, i) => {
                        const last = i === TERRAIN_ROWS.length - 1;
                        const cell = last ? { ...TERRAIN_CELL, borderBottom: "none" } : TERRAIN_CELL;
                        return (
                            <tr key={row.name}>
                                <td style={{ ...cell, fontWeight: 600, textAlign: "left" }}>{row.name}</td>
                                <td style={cell}>{row.move}</td>
                                <td style={cell}>{row.los}</td>
                                <td style={{ ...cell, color: row.combatColor || cell.color }}>{row.combat}</td>
                                <td style={cell}>{row.indicator ? <IndicatorIcon type={row.indicator} /> : "—"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div style={{ fontSize: 11, color: "#8a7a60", marginTop: 8 }}>* Détail de la ligne de vue dans l'onglet « Ligne de vue ».</div>

            {TERRAIN_DETAILS.map(({ title, text, scene: SceneComp }) => (
                <div key={title} className="guide-subsection">
                    <div className="guide-subsection-title">{title}</div>
                    <div className="guide-text"><p>{text}</p></div>
                    <div className="guide-scenes"><Scene><SceneComp /></Scene></div>
                </div>
            ))}
        </div>
    );
}

const TAB_CONTENT = {
    objectif: ObjectifTab,
    tour: TourTab,
    unites: UnitesTab,
    combat: CombatTab,
    los: LosTab,
    terrains: TerrainsTab,
};

export default function Guide({ onBack }) {
    const [activeTab, setActiveTab] = useState("objectif");
    const topRef = useRef(null);

    useEffect(() => {
        topRef.current?.scrollIntoView({ block: "start" });
    }, [activeTab]);

    const ActiveContent = TAB_CONTENT[activeTab];

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "#f5f0e8", color: "#2a2015", fontFamily: "'Crimson Text', Georgia, serif", padding: "30px 20px" }}>
            <div ref={topRef} style={{ maxWidth: 680, width: "100%" }}>
                <div className="guide-header">
                    <div className="home-title">
                        <div className="home-title-line" />
                        <div>
                            <div className="home-title-text" style={{ fontSize: 26, letterSpacing: ".3em" }}>GUIDE</div>
                            <div className="home-title-sub">Règles du jeu</div>
                        </div>
                        <div className="home-title-line" />
                    </div>
                    <button className="btn btn-grey guide-back" onClick={onBack}>Retour</button>
                </div>

                <div className="guide-tabs">
                    {TABS.map(item => (
                        <button
                            key={item.id}
                            className={`guide-tab${item.id === activeTab ? " active" : ""}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <ActiveContent />

                <div style={{ textAlign: "center", marginTop: 8, marginBottom: 20 }}>
                    <button className="btn btn-grey" onClick={onBack} style={{ width: "auto", padding: "6px 16px" }}>
                        Retour
                    </button>
                </div>
            </div>
        </div>
    );
}
