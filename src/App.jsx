import { useState, useEffect, useRef } from "react";
import { hexToPixel, pixelToHex, hexDistance, hexKey, isValidHex, reachableHexes, hasLineOfSight } from "./hex.js";
import { resolveAttack, damageMultiplier } from "./combat.js";
import { initState, resetUID } from "./units.js";
import { drawScene, CANVAS_W, CANVAS_H, OX, OY } from "./renderer.js";

export default function HexWarhammer() {
    const canvasRef = useRef(null);
    const [state, setState] = useState(initState);
    const [hoveredHex, setHoveredHex] = useState(null);
    const [diceAnim, setDiceAnim] = useState(null);

    useEffect(() => {
        drawScene(canvasRef.current, state, hoveredHex);
    }, [state, hoveredHex]);

    useEffect(() => {
        if (!diceAnim || diceAnim.done) return;
        const { log, phase, dice } = diceAnim;
        const entry = log[phase];
        if (!entry) {
            // All phases revealed — apply damage
            setDiceAnim(a => ({ ...a, done: true }));
            setState(s => {
                const { attacker, target, damage, isDead } = diceAnim;
                const newWounds = Math.max(0, target.currentWounds - damage);
                const units = s.units.map(u => {
                    if (u.id === attacker.id) return { ...u, hasAttacked: true };
                    if (u.id === target.id) return { ...u, currentWounds: newWounds };
                    return u;
                });
                const remainingEnemies = units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
                const winner = remainingEnemies.length === 0 ? s.currentPlayer : null;
                const combatLog = [
                    `⚔ ${attacker.name} → ${target.name} [${diceAnim.weaponName}]`,
                    isDead ? `💀 ${target.name} éliminé !` : `❤ ${target.name} : ${newWounds}/${target.wounds} PV`,
                    ...s.combatLog.slice(0, 8),
                ];
                return {
                    ...s, units, phase: "select", selectedUnit: null, validMoves: [], validTargets: [],
                    pendingAttack: null, combatLog, winner,
                    roundLog: { weapon: diceAnim.weaponName, attacker: attacker.name, target: target.name, log, isDead, damage },
                };
            });
            return;
        }
        const rolls = entry.rolls || [];
        if (rolls.length === 0 || dice >= rolls.length) {
            // Phase fully revealed, move to next
            const delay = entry.isSummary ? 800 : 600;
            const timer = setTimeout(() => setDiceAnim(a => ({ ...a, phase: a.phase + 1, dice: 0 })), delay);
            return () => clearTimeout(timer);
        }
        // Reveal next die
        const timer = setTimeout(() => setDiceAnim(a => ({ ...a, dice: a.dice + 1 })), 350);
        return () => clearTimeout(timer);
    }, [diceAnim]);

    function onCanvasClick(e) {
        if (diceAnim && !diceAnim.done) return;
        if (diceAnim?.done) setDiceAnim(null);
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
        if (s.winner || s.phase === "weapon_select" || s.phase === "resolving") return s;
        const k = hexKey(hex);
        const unitOnHex = s.units.find(u => u.currentWounds > 0 && hexKey(u.hex) === k);
        const moveKeys = new Set(s.validMoves.map(hexKey));
        const targetKeys = new Set((s.validTargets || []).map(u => hexKey(u.hex)));

        if (s.phase === "attack" && targetKeys.has(k)) {
            const target = s.validTargets.find(u => hexKey(u.hex) === k);
            return { ...s, phase: "weapon_select", pendingAttack: { attacker: s.selectedUnit, target }, roundLog: null };
        }

        if (s.phase === "move" && moveKeys.has(k)) {
            const movedUnit = { ...s.selectedUnit, hex, hasMoved: true };
            const units = s.units.map(u => u.id === movedUnit.id ? movedUnit : u);
            return { ...s, units, selectedUnit: movedUnit, phase: "select", validMoves: [], validTargets: [], roundLog: null };
        }

        if (unitOnHex && unitOnHex.player === s.currentPlayer) {
            const cur = s.units.find(u => u.id === unitOnHex.id);
            const occupied = new Set(s.units.filter(u => u.currentWounds > 0 && u.id !== cur.id).map(u => hexKey(u.hex)));
            const obsKeys = new Set(s.obstacles.map(hexKey));
            const validMoves = cur.hasMoved ? [] : reachableHexes(cur.hex, cur.movement, occupied, obsKeys);
            const enemies = s.units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
            const maxRange = Math.max(...cur.weapons.map(w => w.range));
            const validTargets = cur.hasAttacked ? [] : enemies.filter(e => hexDistance(cur.hex, e.hex) <= maxRange && hasLineOfSight(cur.hex, e.hex, obsKeys));
            return { ...s, selectedUnit: cur, phase: "select", validMoves, validTargets, roundLog: null };
        }

        return s;
    }

    function startMove() {
        setState(s => {
            const cur = s.units.find(u => u.id === s.selectedUnit?.id);
            if (!cur || cur.hasMoved) return s;
            const occupied = new Set(s.units.filter(u => u.currentWounds > 0 && u.id !== cur.id).map(u => hexKey(u.hex)));
            const obsKeys = new Set(s.obstacles.map(hexKey));
            return { ...s, phase: "move", validMoves: reachableHexes(cur.hex, cur.movement, occupied, obsKeys), validTargets: [] };
        });
    }

    function startAttack() {
        setState(s => {
            const cur = s.units.find(u => u.id === s.selectedUnit?.id);
            if (!cur || cur.hasAttacked) return s;
            const enemies = s.units.filter(u => u.player !== s.currentPlayer && u.currentWounds > 0);
            const maxRange = Math.max(...cur.weapons.map(w => w.range));
            const obsKeys = new Set(s.obstacles.map(hexKey));
            const validTargets = enemies.filter(e => hexDistance(cur.hex, e.hex) <= maxRange && hasLineOfSight(cur.hex, e.hex, obsKeys));
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
            const isDead = Math.max(0, target.currentWounds - damage) <= 0;

            setDiceAnim({ log, phase: 0, dice: 0, done: false, attacker, target, weaponName: weapon.name, damage, isDead });

            return { ...s, phase: "resolving", roundLog: null };
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

    function restart() { resetUID(); setState(initState()); }

    const sel = state.selectedUnit ? state.units.find(u => u.id === state.selectedUnit.id) : null;
    const P = { 1: "#2a6fa8", 2: "#a03030" };
    const phaseLabel = {
        select: "SÉLECTION", move: "MOUVEMENT", attack: "ATTAQUE", weapon_select: "CHOIX D'ARME", resolving: "RÉSOLUTION",
    }[state.phase] || "";

    return (
        <div style={{ display: "flex", height: "100vh", background: "#f5f0e8", color: "#2a2015", fontFamily: "'Crimson Text', Georgia, serif", overflow: "hidden" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #c8b898; }
        .btn {
          display: block; width: 100%; padding: 7px 12px; margin-bottom: 6px;
          font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: .08em;
          border-radius: 1px; cursor: pointer; transition: filter .15s, opacity .15s; text-align: center;
        }
        .btn:hover:not(:disabled) { filter: brightness(1.35); }
        .btn:disabled { opacity: .3; cursor: not-allowed; }
        .btn-blue  { background: rgba(42,111,168,.1); border: 1px solid #2a6fa8; color: #2a6fa8; }
        .btn-red   { background: rgba(160,48,48,.1); border: 1px solid #a03030; color: #a03030; }
        .btn-gold  { background: rgba(150,110,10,.1); border: 1px solid #8a6a08; color: #8a6a08; }
        .btn-grey  { background: transparent; border: 1px solid #c8b898; color: #8a7a60; }
        .weapon-card {
          width: 100%; background: #ece5d8; border: 1px solid #d5cbb8; color: #2a2015;
          font-family: 'Crimson Text', serif; text-align: left; padding: 8px 10px; margin-bottom: 5px;
          cursor: pointer; transition: border-color .15s, background .15s; border-radius: 2px;
        }
        .weapon-card:hover { border-color: #8a6a08; background: #e0d8c8; }
        .weapon-card.disabled { opacity: .35; cursor: not-allowed; }
        .sr { display: flex; justify-content: space-between; align-items: center; padding: 2px 0; }
        .sl { color: #8a7a60; font-size: 12px; }
        .sv { font-size: 13px; font-weight: 600; }
        .roll-chip {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 3px; font-size: 12px; font-weight: 700;
          margin: 1px; border: 1px solid;
        }
        .roll-hit { background: rgba(76,175,80,.15); border-color: #4caf50; color: #2e7d32; }
        .roll-miss { background: rgba(244,67,54,.1); border-color: #e53935; color: #c62828; }
        canvas { cursor: crosshair; display: block; }
        .roll-new { animation: diceAppear .45s ease-out; }
        @keyframes diceAppear {
          0% { transform: scale(0) rotate(-180deg); opacity: 0; }
          50% { transform: scale(1.4) rotate(15deg); opacity: 1; }
          75% { transform: scale(0.9) rotate(-5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: .4; }
          50% { opacity: 1; }
        }
      `}</style>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 20 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700, letterSpacing: ".2em", color: "#8a6a08", textShadow: "0 0 30px rgba(138,106,8,.2)" }}>
                    ⚔ HEX WARHAMMER ⚔
                </div>

                <div style={{ position: "relative" }}>
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_W}
                        height={CANVAS_H}
                        style={{ border: "1px solid #c8b898", maxWidth: "100%" }}
                        onClick={onCanvasClick}
                        onMouseMove={onMouseMove}
                        onMouseLeave={() => setHoveredHex(null)}
                    />
                    <div style={{
                        position: "absolute", top: 8, left: 8,
                        background: "rgba(245,240,232,.92)", border: `1px solid ${P[state.currentPlayer]}`,
                        padding: "4px 12px", fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: ".1em",
                        color: P[state.currentPlayer], borderRadius: 1,
                    }}>
                        {state.winner ? `🏆 JOUEUR ${state.winner} VICTORIEUX` : `J${state.currentPlayer} — ${phaseLabel}`}
                    </div>
                    <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(245,240,232,.92)", border: "1px solid #c8b898", padding: "4px 10px", fontFamily: "'Cinzel', serif", fontSize: 10, color: "#8a7a60" }}>
                        TOUR {state.round}
                    </div>
                    <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 12, fontSize: 11, color: "#8a7a60" }}>
                        <span style={{ color: "#2a6fa8" }}>● Joueur 1</span>
                        <span style={{ color: "#a03030" }}>● Joueur 2</span>
                        <span>■ Déplacement possible</span>
                        <span style={{ color: "#b03030" }}>■ Cible</span>
                        <span style={{ color: "#8a7a60" }}>▲ Obstacle</span>
                    </div>
                </div>
            </div>

            <div style={{ width: 290, borderLeft: "1px solid #d5cbb8", background: "#ece5d8", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #d5cbb8", minHeight: 195 }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 10 }}>UNITÉ SÉLECTIONNÉE</div>
                    {sel ? (
                        <>
                            <div style={{ fontSize: 15, fontWeight: 600, color: P[sel.player], marginBottom: 1 }}>{sel.symbol} {sel.name}</div>
                            <div style={{ fontSize: 11, color: "#8a7a60", marginBottom: 8 }}>Joueur {sel.player}</div>
                            <div style={{ borderTop: "1px solid #d5cbb8", paddingTop: 8, display: "flex", flexDirection: "column", gap: 1 }}>
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
                        <div style={{ color: "#a09080", fontSize: 13, fontStyle: "italic" }}>Cliquez sur une de vos unités pour la sélectionner.</div>
                    )}
                </div>

                <div style={{ padding: "12px 16px", borderBottom: "1px solid #d5cbb8" }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 10 }}>ACTIONS</div>

                    {state.phase === "weapon_select" && state.pendingAttack ? (
                        <>
                            <div style={{ fontSize: 12, color: "#8a6a08", marginBottom: 8 }}>
                                Attaquer <strong>{state.pendingAttack.target.name}</strong> avec :
                            </div>
                            {state.pendingAttack.attacker.weapons.map(w => {
                                const dist = hexDistance(state.pendingAttack.attacker.hex, state.pendingAttack.target.hex);
                                const ok = dist <= w.range;
                                const target = state.pendingAttack.target;
                                const mult = damageMultiplier(w.strength, target.toughness);
                                const effectiveSave = target.save + Math.abs(w.ap);
                                const cantSave = effectiveSave > 6;
                                const multColor = mult >= 2 ? "#2e7d32" : mult >= 1.5 ? "#558b2f" : mult === 1 ? "#8a7a60" : mult <= 0.25 ? "#c62828" : "#e65100";
                                const saveColor = cantSave ? "#2e7d32" : effectiveSave >= 6 ? "#558b2f" : effectiveSave >= 4 ? "#8a7a60" : effectiveSave >= 3 ? "#e65100" : "#c62828";
                                return (
                                    <button key={w.id} className={`weapon-card${ok ? "" : " disabled"}`} onClick={() => ok && selectWeapon(w)}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{w.name} {w.type === "ranged" ? "🏹" : "🗡"}</div>
                                        <div style={{ fontSize: 11, color: ok ? "#8a7a60" : "#b0a090", marginTop: 3 }}>
                                            {w.type === "ranged" ? `Portée ${w.range}` : "Mêlée (adj.)"} · A{w.attacks} F{w.strength} PA{w.ap} D{w.damage}
                                            {!ok && ` · (trop loin: ${dist})`}
                                        </div>
                                        {ok && (
                                            <div style={{ display: "flex", gap: 8, marginTop: 5, fontSize: 10 }}>
                                                <span style={{ color: multColor, fontWeight: 600 }}>Force ×{mult}</span>
                                                <span style={{ color: saveColor, fontWeight: 600 }}>{cantSave ? "Svg impossible" : `Svg ${effectiveSave}+`}</span>
                                            </div>
                                        )}
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
                            <div style={{ borderTop: "1px solid #d5cbb8", marginTop: 6, paddingTop: 8 }}>
                                <button className="btn btn-gold" disabled={!!state.winner} onClick={endTurn}>⏭ Fin de tour</button>
                                {state.winner && <button className="btn btn-grey" onClick={restart}>↺ Nouvelle partie</button>}
                            </div>
                        </>
                    )}
                </div>

                {(diceAnim || state.roundLog) && (() => {
                    const src = diceAnim && !diceAnim.done ? diceAnim : state.roundLog;
                    if (!src) return null;
                    const animating = diceAnim && !diceAnim.done;
                    const visibleLog = animating
                        ? src.log.slice(0, src.phase + 1)
                        : src.log;
                    const atkName = animating ? src.attacker.name : src.attacker;
                    const tgtName = animating ? src.target.name : src.target;
                    const wpnName = animating ? src.weaponName : src.weapon;
                    return (
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid #d5cbb8", background: "#e5ddd0" }}>
                            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 8 }}>RÉSOLUTION DE COMBAT</div>
                            <div style={{ fontSize: 12, color: "#8a6a08", marginBottom: 6 }}>
                                {atkName} → {tgtName} [{wpnName}]
                            </div>
                            {visibleLog.map((entry, i) => {
                                const isCurrentPhase = animating && i === src.phase;
                                const visibleDice = isCurrentPhase ? (entry.rolls || []).slice(0, src.dice) : (entry.rolls || []);
                                return (
                                    <div key={i} style={{ marginBottom: entry.isSummary ? 0 : 5 }}>
                                        <div style={{ fontSize: 11, color: "#6a5a40", marginBottom: visibleDice.length ? 2 : 0 }}>{entry.label}</div>
                                        {visibleDice.length > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
                                                {visibleDice.map((r, j) => {
                                                    const needed = entry.isSave
                                                        ? parseInt((entry.label.match(/(\d+)\+/) || [0, 7])[1])
                                                        : parseInt((entry.label.match(/(\d+)\+/) || [0, 0])[1]);
                                                    const hit = r >= needed;
                                                    const cls = (entry.isSave ? hit : hit) ? (entry.isSave ? "roll-miss" : "roll-hit") : (entry.isSave ? "roll-hit" : "roll-miss");
                                                    const isNew = isCurrentPhase && j === src.dice - 1;
                                                    return <span key={j} className={`roll-chip ${cls}${isNew ? " roll-new" : ""}`}>{r}</span>;
                                                })}
                                            </div>
                                        )}
                                        {entry.isSummary && !animating && (
                                            <div style={{ fontSize: 13, fontWeight: 600, color: src.damage > 0 ? "#e53935" : "#4caf50", marginTop: 4 }}>
                                                {src.isDead ? `💀 ${tgtName} éliminé !` : `${src.damage} dégât(s) infligé(s)`}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {animating && (
                                <div style={{ fontSize: 11, color: "#8a7a60", marginTop: 6, fontStyle: "italic", animation: "pulse 1s infinite" }}>
                                    Lancement des dés...
                                </div>
                            )}
                        </div>
                    );
                })()}

                <div style={{ flex: 1, padding: "10px 16px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 8 }}>JOURNAL</div>
                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                        {state.combatLog.map((entry, i) => (
                            <div key={i} style={{ fontSize: 11, color: `rgba(42,32,21,${Math.max(0.25, 0.9 - i * 0.1)})`, lineHeight: 1.5, borderLeft: `2px solid ${i === 0 ? "#8a6a08" : "transparent"}`, paddingLeft: 6 }}>
                                {entry}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
