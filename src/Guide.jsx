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
    return <canvas ref={ref} width={width} height={height} style={{ display: "block" }} />;
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
            ctx.fillText("×2", riverPos.x + ox, riverPos.y + oy + MINI_HEX + 8);
            drawDashedLine(ctx, p1.x + ox + 12, p1.y + oy, riverPos.x + ox, riverPos.y + oy, "#2a6fa8");
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

const SECTION_STYLE = {
    background: "#ece5d8", border: "1px solid #d5cbb8", borderRadius: 4, padding: 16, marginBottom: 16,
};
const TITLE_STYLE = {
    fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700, letterSpacing: ".12em", color: "#8a6a08", marginBottom: 10,
};
const TEXT_STYLE = { fontSize: 13, lineHeight: 1.6, color: "#2a2015" };

export default function Guide({ onBack }) {
    const unitTypes = Object.entries(UNIT_TEMPLATES);

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

                <div style={SECTION_STYLE}>
                    <div style={TITLE_STYLE}>OBJECTIF</div>
                    <div style={TEXT_STYLE}>
                        <p style={{ margin: "0 0 8px" }}>Warhex est un jeu tactique au tour par tour sur grille hexagonale. Deux joueurs s'affrontent pendant <strong>5 tours</strong>.</p>
                        <p style={{ margin: "0 0 8px" }}>Chaque tour, vous activez <strong>deux unités</strong> (une à la fois) : déplacement et/ou attaque pour chacune, puis le tour passe automatiquement à l'adversaire.</p>
                        <p style={{ margin: "0 0 8px" }}>Les <strong>villes</strong> (🏰) rapportent des points : quand une unité se déplace sur une ville, celle-ci devient la propriété de son joueur (la case change de couleur). La ville reste au joueur tant qu'un adversaire ne s'y déplace pas. Chaque ville possédée rapporte <strong>1 point</strong> en fin de tour. Après 5 tours, le joueur avec le plus de points gagne.</p>
                    </div>
                    <SceneTownControl />
                </div>

                <div style={SECTION_STYLE}>
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
                                    <span>Endurance : <strong>{t.toughness}</strong></span>
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

                <div style={SECTION_STYLE}>
                    <div style={TITLE_STYLE}>COMBAT</div>
                    <div style={TEXT_STYLE}>
                        <p style={{ margin: "0 0 6px" }}><strong>1. To Hit</strong> — Lancez autant de D6 que l'arme a d'attaques. Chaque dé supérieur ou égal à la compétence (CC au corps à corps, CT à distance) est une touche.</p>
                        <p style={{ margin: "0 0 6px" }}><strong>2. Sauvegarde</strong> — Le défenseur lance 3 D6. Chaque dé supérieur ou égal à (sauvegarde + |PA|) annule une touche. Si le seuil dépasse 6, la sauvegarde est impossible.</p>
                        <p style={{ margin: 0 }}><strong>3. Dégâts</strong> — Chaque touche non sauvée inflige les dégâts de l'arme.</p>
                    </div>
                </div>

                <div style={SECTION_STYLE}>
                    <div style={TITLE_STYLE}>TERRAINS</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>▲ Obstacles</div>
                            <div style={TEXT_STYLE}>Bloquent le mouvement et la ligne de vue.</div>
                            <div style={{ marginTop: 6 }}>
                                <SceneLosBlocked />
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>〰 Rivières</div>
                            <div style={TEXT_STYLE}>Traverser une rivière coûte 2 points de mouvement. L'unité s'arrête en entrant.</div>
                            <div style={{ marginTop: 6 }}>
                                <SceneRiverCost />
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🏰 Villes</div>
                            <div style={TEXT_STYLE}>Rapportent 1 point par unité présente en fin de tour. Accordent un bonus de couvert (-1 à la sauvegarde adverse). Bloquent la ligne de vue. L'unité s'arrête en entrant.</div>
                            <div style={{ marginTop: 6 }}>
                                <SceneTownCover />
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🌲 Forêts</div>
                            <div style={TEXT_STYLE}>Bloquent la ligne de vue. Les unités peuvent y entrer et s'y déplacer.</div>
                            <div style={{ marginTop: 6 }}>
                                <SceneForestLos />
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>⛰ Collines</div>
                            <div style={TEXT_STYLE}>Les unités à distance sur une colline gagnent +1 de portée pour leurs armes à distance.</div>
                            <div style={{ marginTop: 6 }}>
                                <SceneHillRange />
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>☠ Marais</div>
                            <div style={TEXT_STYLE}>L'unité s'arrête immédiatement en entrant dans un marais.</div>
                            <div style={{ marginTop: 6 }}>
                                <SceneSwampStop />
                            </div>
                        </div>
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
