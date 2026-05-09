import { useState, useEffect, useRef } from "react";

// ============================================================
// HEX MATH — coordonnées cube (q + r + s = 0)
// ============================================================
const HEX_SIZE = 36;

function hexToPixel(q, r) {
    return {
        x: HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
        y: HEX_SIZE * (1.5 * r),
    };
}

function pixelToHex(x, y) {
    const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / HEX_SIZE;
    const r = ((2 / 3) * y) / HEX_SIZE;
    return cubeRound(q, r, -q - r);
}

function cubeRound(q, r, s) {
    let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    else rs = -rq - rr;
    return { q: rq, r: rr, s: rs };
}

function hexDistance(a, b) {
    return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

function hexKey(h) { return `${h.q},${h.r},${h.s}`; }

const DIRECTIONS = [
    { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
    { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 },
];

function hexNeighbors(h) {
    return DIRECTIONS.map(d => ({ q: h.q + d.q, r: h.r + d.r, s: h.s + d.s }));
}

function isValidHex(h) {
    return Math.abs(h.q) <= 5 && Math.abs(h.r) <= 5 && Math.abs(h.s) <= 5;
}

function hexCorners(cx, cy, size) {
    return Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i - 30);
        return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) };
    });
}

function reachableHexes(start, movement, occupiedKeys) {
    const visited = new Map([[hexKey(start), 0]]);
    const queue = [start];
    const result = [];
    while (queue.length) {
        const cur = queue.shift();
        const dist = visited.get(hexKey(cur));
        if (dist > 0) result.push(cur);
        if (dist < movement) {
            for (const n of hexNeighbors(cur)) {
                const k = hexKey(n);
                if (!visited.has(k) && !occupiedKeys.has(k) && isValidHex(n)) {
                    visited.set(k, dist + 1);
                    queue.push(n);
                }
            }
        }
    }
    return result;
}

// ============================================================
// DÉS & COMBAT
// ============================================================
function rollD6() { return Math.floor(Math.random() * 6) + 1; }
function rollDice(n) { return Array.from({ length: n }, rollD6); }

function woundThreshold(str, tough) {
    if (str >= tough * 2) return 2;
    if (str > tough) return 3;
    if (str === tough) return 4;
    if (str * 2 <= tough) return 6;
    return 5;
}

function resolveAttack(attacker, weapon, target) {
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

// ============================================================
// DONNÉES UNITÉS
// ============================================================
let UID = 0;
function createUnit(type, player, hex) {
    const T = {
        spaceMarine: {
            name: "Space Marine", symbol: "☩",
            movement: 3, weaponSkill: 3, ballisticSkill: 3,
            toughness: 4, wounds: 2, save: 3,
            weapons: [
                { id: "bolter", name: "Bolter", type: "ranged", range: 5, attacks: 2, strength: 4, ap: -1, damage: 1 },
                { id: "knife", name: "Combat Knife", type: "melee", range: 1, attacks: 3, strength: 4, ap: 0, damage: 1 },
            ],
        },
        orcBoy: {
            name: "Orc Boy", symbol: "✦",
            movement: 3, weaponSkill: 3, ballisticSkill: 5,
            toughness: 4, wounds: 1, save: 6,
            weapons: [
                { id: "choppa", name: "Choppa", type: "melee", range: 1, attacks: 3, strength: 5, ap: -1, damage: 1 },
                { id: "slugga", name: "Slugga", type: "ranged", range: 3, attacks: 1, strength: 4, ap: 0, damage: 1 },
            ],
        },
        chaosWarrior: {
            name: "Chaos Warrior", symbol: "✸",
            movement: 2, weaponSkill: 4, ballisticSkill: 4,
            toughness: 5, wounds: 3, save: 4,
            weapons: [
                { id: "chainsword", name: "Chainsword", type: "melee", range: 1, attacks: 4, strength: 5, ap: -1, damage: 2 },
                { id: "bolt_pistol", name: "Bolt Pistol", type: "ranged", range: 3, attacks: 1, strength: 4, ap: 0, damage: 1 },
            ],
        },
    };
    const t = T[type];
    return { ...t, id: UID++, player, hex, currentWounds: t.wounds, hasMoved: false, hasAttacked: false };
}

function initState() {
    const units = [
        createUnit("spaceMarine", 1, { q: -4, r: 0, s: 4 }),
        createUnit("orcBoy", 1, { q: -3, r: 3, s: 0 }),
        createUnit("spaceMarine", 1, { q: -4, r: 2, s: 2 }),
        createUnit("chaosWarrior", 2, { q: 4, r: 0, s: -4 }),
        createUnit("orcBoy", 2, { q: 3, r: -3, s: 0 }),
        createUnit("chaosWarrior", 2, { q: 4, r: -2, s: -2 }),
    ];
    return {
        units,
        currentPlayer: 1,
        phase: "select",
        selectedUnit: null,
        validMoves: [],
        validTargets: [],
        pendingAttack: null,
        combatLog: [],
        roundLog: null, // résultat du dernier combat
        winner: null,
        round: 1,
    };
}

// ============================================================
// CANVAS RENDERER
// ============================================================
const CANVAS_W = 620;
const CANVAS_H = 540;
const OX = CANVAS_W / 2;
const OY = CANVAS_H / 2;

function drawScene(canvas, state, hoveredHex) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background texture
    ctx.fillStyle = "#0c0906";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const validMoveKeys = new Set(state.validMoves.map(hexKey));
    const validTargetKeys = new Set((state.validTargets || []).map(u => hexKey(u.hex)));

    // All hexes
    const hexes = [];
    for (let q = -6; q <= 6; q++)
        for (let r = -6; r <= 6; r++) {
            const s = -q - r;
            if (isValidHex({ q, r, s })) hexes.push({ q, r, s });
        }

    hexes.forEach(hex => {
        const { x, y } = hexToPixel(hex.q, hex.r);
        const px = x + OX, py = y + OY;
        const k = hexKey(hex);
        const isMove = validMoveKeys.has(k);
        const isTarget = validTargetKeys.has(k);
        const isHover = hoveredHex && hexKey(hoveredHex) === k;
        const corners = hexCorners(px, py, HEX_SIZE);

        ctx.beginPath();
        corners.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
        ctx.closePath();

        let fill = "#161008";
        if (isMove) fill = isHover ? "rgba(80,160,255,0.32)" : "rgba(80,160,255,0.12)";
        if (isTarget) fill = isHover ? "rgba(220,50,50,0.45)" : "rgba(220,50,50,0.2)";
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = isTarget ? "#cc3333" : isMove ? "#3a7abf" : "#221608";
        ctx.lineWidth = isTarget || isMove ? 1.5 : 0.8;
        ctx.stroke();
    });

    // Units
    state.units.forEach(unit => {
        if (unit.currentWounds <= 0) return;
        const { x, y } = hexToPixel(unit.hex.q, unit.hex.r);
        const px = x + OX, py = y + OY;
        const r = HEX_SIZE * 0.52;
        const isSelected = state.selectedUnit?.id === unit.id;
        const isDimmed = unit.hasMoved && unit.hasAttacked;

        const P1 = { fill: "#0e2a42", ring: "#3a80c4" };
        const P2 = { fill: "#300808", ring: "#b03030" };
        const col = unit.player === 1 ? P1 : P2;

        if (isSelected) {
            ctx.shadowBlur = 24;
            ctx.shadowColor = col.ring;
        }

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = isDimmed ? "#101010" : col.fill;
        ctx.fill();
        ctx.strokeStyle = isDimmed ? "#333" : col.ring;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = `${HEX_SIZE * 0.52}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = isDimmed ? 0.35 : 1;
        ctx.fillStyle = "#e8d5a3";
        ctx.fillText(unit.symbol, px, py);
        ctx.globalAlpha = 1;

        // HP bar
        const bw = HEX_SIZE * 1.15, bh = 4;
        const bx = px - bw / 2, by = py + r + 4;
        ctx.fillStyle = "#1a1008";
        ctx.fillRect(bx, by, bw, bh);
        const ratio = unit.currentWounds / unit.wounds;
        ctx.fillStyle = ratio > 0.5 ? "#4caf50" : ratio > 0.25 ? "#ff9800" : "#e53935";
        ctx.fillRect(bx, by, bw * ratio, bh);

        // Player dot
        ctx.beginPath();
        ctx.arc(px + r - 4, py - r + 4, 4, 0, Math.PI * 2);
        ctx.fillStyle = unit.player === 1 ? "#3a80c4" : "#b03030";
        ctx.fill();
    });
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function HexWarhammer() {
    const canvasRef = useRef(null);
    const [state, setState] = useState(initState);
    const [hoveredHex, setHoveredHex] = useState(null);

    useEffect(() => {
        drawScene(canvasRef.current, state, hoveredHex);
    }, [state, hoveredHex]);

    // ── Clicks canvas ──────────────────────────────────────────
    function onCanvasClick(e) {
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = CANVAS_W / rect.width, sy = CANVAS_H / rect.height;
        const x = (e.clientX - rect.left) * sx - OX;
        const y = (e.clientY - rect.top) * sy - OY;
        const hex = pixelToHex(x, y);
        if (!isValidHex(hex)) return;
        setState(prev => handleClick(prev, hex));
    }

    function onMouseMove(e) {
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = CANVAS_W / rect.width, sy = CANVAS_H / rect.height;
        const x = (e.clientX - rect.left) * sx - OX;
        const y = (e.clientY - rect.top) * sy - OY;
        const hex = pixelToHex(x, y);
        setHoveredHex(isValidHex(hex) ? hex : null);
    }

    function handleClick(s, hex) {
        if (s.winner || s.phase === "weapon_select") return s;
        const k = hexKey(hex);
        const unitOnHex = s.units.find(u => u.currentWounds > 0 && hexKey(u.hex) === k);
        const moveKeys = new Set(s.validMoves.map(hexKey));
        const targetKeys = new Set((s.validTargets || []).map(u => hexKey(u.hex)));

        // Clic sur cible valide → sélection arme
        if (s.phase === "attack" && targetKeys.has(k)) {
            const target = s.validTargets.find(u => hexKey(u.hex) === k);
            return { ...s, phase: "weapon_select", pendingAttack: { attacker: s.selectedUnit, target }, roundLog: null };
        }

        // Clic sur hex de mouvement
        if (s.phase === "move" && moveKeys.has(k)) {
            const movedUnit = { ...s.selectedUnit, hex, hasMoved: true };
            const units = s.units.map(u => u.id === movedUnit.id ? movedUnit : u);
            return { ...s, units, selectedUnit: movedUnit, phase: "select", validMoves: [], validTargets: [], roundLog: null };
        }

        // Clic sur propre unité
        if (unitOnHex && unitOnHex.player === s.currentPlayer) {
            const cur = s.units.find(u => u.id === unitOnHex.id);
            const occupied = new Set(s.units.filter(u => u.currentWounds > 0 && u.id !== cur.id).map(u => hexKey(u.hex)));
            const validMoves = cur.hasMoved ? [] : reachableHexes(cur.hex, cur.movement, occupied);
            const enemies = s.units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
            const maxRange = Math.max(...cur.weapons.map(w => w.range));
            const validTargets = cur.hasAttacked ? [] : enemies.filter(e => hexDistance(cur.hex, e.hex) <= maxRange);
            return { ...s, selectedUnit: cur, phase: "select", validMoves, validTargets, roundLog: null };
        }

        return s;
    }

    // ── Actions panneau ────────────────────────────────────────
    function startMove() {
        setState(s => {
            const cur = s.units.find(u => u.id === s.selectedUnit?.id);
            if (!cur || cur.hasMoved) return s;
            const occupied = new Set(s.units.filter(u => u.currentWounds > 0 && u.id !== cur.id).map(u => hexKey(u.hex)));
            return { ...s, phase: "move", validMoves: reachableHexes(cur.hex, cur.movement, occupied), validTargets: [] };
        });
    }

    function startAttack() {
        setState(s => {
            const cur = s.units.find(u => u.id === s.selectedUnit?.id);
            if (!cur || cur.hasAttacked) return s;
            const enemies = s.units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
            const maxRange = Math.max(...cur.weapons.map(w => w.range));
            const validTargets = enemies.filter(e => hexDistance(cur.hex, e.hex) <= maxRange);
            return { ...s, phase: "attack", validTargets, validMoves: [], selectedUnit: cur };
        });
    }

    function selectWeapon(weapon) {
        setState(s => {
            if (!s.pendingAttack) return s;
            const { attacker, target } = s.pendingAttack;
            const dist = hexDistance(attacker.hex, target.hex);
            if (dist > weapon.range) {
                return { ...s, combatLog: [`❌ ${weapon.name} hors portée`, ...s.combatLog.slice(0, 10)], phase: "select", pendingAttack: null, validTargets: [], validMoves: [] };
            }

            const { damage, log } = resolveAttack(attacker, weapon, target);
            const newWounds = Math.max(0, target.currentWounds - damage);
            const isDead = newWounds <= 0;

            const units = s.units.map(u => {
                if (u.id === attacker.id) return { ...u, hasAttacked: true };
                if (u.id === target.id) return { ...u, currentWounds: newWounds };
                return u;
            });

            const remainingEnemies = units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
            const winner = remainingEnemies.length === 0 ? s.currentPlayer : null;

            const combatLog = [
                `⚔ ${attacker.name} → ${target.name} [${weapon.name}]`,
                isDead ? `💀 ${target.name} éliminé !` : `❤ ${target.name} : ${newWounds}/${target.wounds} PV`,
                ...s.combatLog.slice(0, 8),
            ];

            return {
                ...s, units, phase: "select", selectedUnit: null, validMoves: [], validTargets: [],
                pendingAttack: null, combatLog, winner,
                roundLog: { weapon: weapon.name, attacker: attacker.name, target: target.name, log, isDead, damage },
            };
        });
    }

    function endTurn() {
        setState(s => {
            if (s.winner) return s;
            const nextPlayer = s.currentPlayer === 1 ? 2 : 1;
            return {
                ...s,
                units: s.units.map(u => ({ ...u, hasMoved: false, hasAttacked: false })),
                currentPlayer: nextPlayer,
                phase: "select", selectedUnit: null, validMoves: [], validTargets: [], pendingAttack: null,
                combatLog: [`— Tour ${s.round + (nextPlayer === 1 ? 1 : 0)}, Joueur ${nextPlayer}`, ...s.combatLog.slice(0, 9)],
                round: nextPlayer === 1 ? s.round + 1 : s.round,
                roundLog: null,
            };
        });
    }

    function restart() { UID = 0; setState(initState()); }

    // ── Dérivés UI ─────────────────────────────────────────────
    const sel = state.selectedUnit ? state.units.find(u => u.id === state.selectedUnit.id) : null;
    const P = { 1: "#3a80c4", 2: "#b03030" };
    const phaseLabel = {
        select: "SÉLECTION", move: "MOUVEMENT", attack: "ATTAQUE", weapon_select: "CHOIX D'ARME",
    }[state.phase] || "";

    return (
        <div style={{ display: "flex", height: "100vh", background: "#0c0906", color: "#e8d5a3", fontFamily: "'Crimson Text', Georgia, serif", overflow: "hidden" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #3a2010; }
        .btn {
          display: block; width: 100%; padding: 7px 12px; margin-bottom: 6px;
          font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: .08em;
          border-radius: 1px; cursor: pointer; transition: filter .15s, opacity .15s; text-align: center;
        }
        .btn:hover:not(:disabled) { filter: brightness(1.35); }
        .btn:disabled { opacity: .3; cursor: not-allowed; }
        .btn-blue  { background: rgba(58,128,196,.12); border: 1px solid #3a80c4; color: #3a80c4; }
        .btn-red   { background: rgba(176, 48,48,.12); border: 1px solid #b03030; color: #c05050; }
        .btn-gold  { background: rgba(184,134,11,.12); border: 1px solid #b8860b; color: #b8860b; }
        .btn-grey  { background: transparent; border: 1px solid #3a2010; color: #6a5040; }
        .weapon-card {
          width: 100%; background: #120d08; border: 1px solid #2a1a08; color: #e8d5a3;
          font-family: 'Crimson Text', serif; text-align: left; padding: 8px 10px; margin-bottom: 5px;
          cursor: pointer; transition: border-color .15s, background .15s; border-radius: 2px;
        }
        .weapon-card:hover { border-color: #b8860b; background: #1c1308; }
        .weapon-card.disabled { opacity: .35; cursor: not-allowed; }
        .sr { display: flex; justify-content: space-between; align-items: center; padding: 2px 0; }
        .sl { color: #6a5040; font-size: 12px; }
        .sv { font-size: 13px; font-weight: 600; }
        .roll-chip {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 3px; font-size: 12px; font-weight: 700;
          margin: 1px; border: 1px solid;
        }
        .roll-hit { background: rgba(76,175,80,.2); border-color: #4caf50; color: #81c784; }
        .roll-miss { background: rgba(244,67,54,.15); border-color: #e53935; color: #ef9a9a; }
        canvas { cursor: crosshair; display: block; }
      `}</style>

            {/* ── Canvas ────────────────────────────────────────── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 20 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700, letterSpacing: ".2em", color: "#b8860b", textShadow: "0 0 30px rgba(184,134,11,.35)" }}>
                    ⚔ HEX WARHAMMER ⚔
                </div>

                <div style={{ position: "relative" }}>
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_W}
                        height={CANVAS_H}
                        style={{ border: "1px solid #221608", maxWidth: "100%" }}
                        onClick={onCanvasClick}
                        onMouseMove={onMouseMove}
                        onMouseLeave={() => setHoveredHex(null)}
                    />
                    {/* Phase badge */}
                    <div style={{
                        position: "absolute", top: 8, left: 8,
                        background: "rgba(12,9,6,.9)", border: `1px solid ${P[state.currentPlayer]}`,
                        padding: "4px 12px", fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: ".1em",
                        color: P[state.currentPlayer], borderRadius: 1,
                    }}>
                        {state.winner ? `🏆 JOUEUR ${state.winner} VICTORIEUX` : `J${state.currentPlayer} — ${phaseLabel}`}
                    </div>
                    {/* Round */}
                    <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(12,9,6,.9)", border: "1px solid #2a1a08", padding: "4px 10px", fontFamily: "'Cinzel', serif", fontSize: 10, color: "#6a5040" }}>
                        TOUR {state.round}
                    </div>
                    {/* Legend */}
                    <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 12, fontSize: 11, color: "#6a5040" }}>
                        <span style={{ color: "#3a80c4" }}>● Joueur 1</span>
                        <span style={{ color: "#b03030" }}>● Joueur 2</span>
                        <span>■ Déplacement possible</span>
                        <span style={{ color: "#b03030" }}>■ Cible</span>
                    </div>
                </div>
            </div>

            {/* ── Panneau droit ────────────────────────────────── */}
            <div style={{ width: 290, borderLeft: "1px solid #1e1208", background: "#0f0a06", display: "flex", flexDirection: "column", flexShrink: 0 }}>

                {/* Unité sélectionnée */}
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e1208", minHeight: 195 }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".15em", color: "#4a3020", marginBottom: 10 }}>UNITÉ SÉLECTIONNÉE</div>
                    {sel ? (
                        <>
                            <div style={{ fontSize: 15, fontWeight: 600, color: P[sel.player], marginBottom: 1 }}>{sel.symbol} {sel.name}</div>
                            <div style={{ fontSize: 11, color: "#4a3020", marginBottom: 8 }}>Joueur {sel.player}</div>
                            <div style={{ borderTop: "1px solid #1e1208", paddingTop: 8, display: "flex", flexDirection: "column", gap: 1 }}>
                                {[
                                    ["PV", `${sel.currentWounds}/${sel.wounds}`, sel.currentWounds > sel.wounds / 2 ? "#4caf50" : "#e53935"],
                                    ["Mouvement", sel.movement], ["CC", `${sel.weaponSkill}+`], ["CT", `${sel.ballisticSkill}+`],
                                    ["Endurance", sel.toughness], ["Sauvegarde", `${sel.save}+`],
                                    ["Déplacé", sel.hasMoved ? "✓" : "—"], ["Attaqué", sel.hasAttacked ? "✓" : "—"],
                                ].map(([label, val, c]) => (
                                    <div key={label} className="sr">
                                        <span className="sl">{label}</span>
                                        <span className="sv" style={c ? { color: c } : {}}>{val}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ color: "#3a2810", fontSize: 13, fontStyle: "italic" }}>Cliquez sur une de vos unités pour la sélectionner.</div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1208" }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".15em", color: "#4a3020", marginBottom: 10 }}>ACTIONS</div>

                    {state.phase === "weapon_select" && state.pendingAttack ? (
                        <>
                            <div style={{ fontSize: 12, color: "#b8860b", marginBottom: 8 }}>
                                Attaquer <strong>{state.pendingAttack.target.name}</strong> avec :
                            </div>
                            {state.pendingAttack.attacker.weapons.map(w => {
                                const dist = hexDistance(state.pendingAttack.attacker.hex, state.pendingAttack.target.hex);
                                const ok = dist <= w.range;
                                return (
                                    <button key={w.id} className={`weapon-card${ok ? "" : " disabled"}`} onClick={() => ok && selectWeapon(w)}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{w.name} {w.type === "ranged" ? "🏹" : "🗡"}</div>
                                        <div style={{ fontSize: 11, color: ok ? "#8a7050" : "#4a3020", marginTop: 3 }}>
                                            {w.type === "ranged" ? `Portée ${w.range}` : "Mêlée (adj.)"} · A{w.attacks} F{w.strength} PA{w.ap} D{w.damage}
                                            {!ok && ` · (trop loin: ${dist})`}
                                        </div>
                                    </button>
                                );
                            })}
                            <button className="btn btn-grey" onClick={() => setState(s => ({ ...s, phase: "select", pendingAttack: null, validTargets: [], validMoves: [] }))}>✕ Annuler</button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-blue" disabled={!sel || sel.hasMoved || state.phase === "attack"} onClick={startMove}>⟶ Déplacer</button>
                            <button className="btn btn-red" disabled={!sel || sel.hasAttacked} onClick={startAttack}>⚔ Attaquer</button>
                            {sel && <button className="btn btn-grey" onClick={() => setState(s => ({ ...s, selectedUnit: null, phase: "select", validMoves: [], validTargets: [] }))}>✕ Désélectionner</button>}
                            <div style={{ borderTop: "1px solid #1e1208", marginTop: 6, paddingTop: 8 }}>
                                <button className="btn btn-gold" disabled={!!state.winner} onClick={endTurn}>⏭ Fin de tour</button>
                                {state.winner && <button className="btn btn-grey" onClick={restart}>↺ Nouvelle partie</button>}
                            </div>
                        </>
                    )}
                </div>

                {/* Résultat de combat */}
                {state.roundLog && (
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1208", background: "#0d0806" }}>
                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".15em", color: "#4a3020", marginBottom: 8 }}>RÉSOLUTION DE COMBAT</div>
                        <div style={{ fontSize: 12, color: "#b8860b", marginBottom: 6 }}>
                            {state.roundLog.attacker} → {state.roundLog.target} [{state.roundLog.weapon}]
                        </div>
                        {state.roundLog.log.map((entry, i) => (
                            <div key={i} style={{ marginBottom: entry.isSummary ? 0 : 5 }}>
                                <div style={{ fontSize: 11, color: "#8a7050", marginBottom: entry.rolls?.length ? 2 : 0 }}>{entry.label}</div>
                                {entry.rolls?.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
                                        {entry.rolls.map((r, j) => {
                                            const needed = entry.isSave
                                                ? parseInt(entry.label.match(/(\d+)\+/) || [0, 7])[1]
                                                : parseInt(entry.label.match(/(\d+)\+/) || [0, 0])[1];
                                            const hit = entry.isSave ? r >= needed : r >= needed;
                                            const cls = (entry.isSave ? hit : hit) ? (entry.isSave ? "roll-miss" : "roll-hit") : (entry.isSave ? "roll-hit" : "roll-miss");
                                            return <span key={j} className={`roll-chip ${cls}`}>{r}</span>;
                                        })}
                                    </div>
                                )}
                                {entry.isSummary && (
                                    <div style={{ fontSize: 13, fontWeight: 600, color: state.roundLog.damage > 0 ? "#e53935" : "#4caf50", marginTop: 4 }}>
                                        {state.roundLog.isDead ? `💀 ${state.roundLog.target} éliminé !` : `${state.roundLog.damage} dégât(s) infligé(s)`}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Journal */}
                <div style={{ flex: 1, padding: "10px 16px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".15em", color: "#4a3020", marginBottom: 8 }}>JOURNAL</div>
                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                        {state.combatLog.map((entry, i) => (
                            <div key={i} style={{ fontSize: 11, color: `rgba(232,213,163,${Math.max(0.2, 0.9 - i * 0.1)})`, lineHeight: 1.5, borderLeft: `2px solid ${i === 0 ? "#b8860b" : "transparent"}`, paddingLeft: 6 }}>
                                {entry}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}