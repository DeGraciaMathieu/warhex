import { useState, useEffect, useRef } from "react";
import { hexToPixel, pixelToHex, hexDistance, hexKey, isValidHex } from "./hex.js";
import { initState, resetUID, UNIT_TEMPLATES, ACTIVATIONS_PER_TURN } from "./units.js";
import { drawScene, CANVAS_W, CANVAS_H, OX, OY, DEATH_ANIM_DURATION } from "./renderer.js";
import { handleClick, computeMove, computeAttack, computeWeaponSelect, applyDamage, computeEndTurn, computeDeselect } from "./game.js";
import { computeAIAction, buildAIPreview } from "./ai.js";
import Guide from "./Guide.jsx";
import "./styles.css";

const UNIT_TYPES = Object.keys(UNIT_TEMPLATES);
const ARMY_SIZE = 5;

export default function HexWarhammer() {
    const canvasRef = useRef(null);
    const [armyPhase, setArmyPhase] = useState(true);
    const [showGuide, setShowGuide] = useState(false);
    const [vsAI, setVsAI] = useState(false);
    const [fairTowns, setFairTowns] = useState(true);
    const [selections, setSelections] = useState({ 1: [], 2: [] });
    const [state, setState] = useState(null);
    const [hoveredHex, setHoveredHex] = useState(null);
    const [diceAnim, setDiceAnim] = useState(null);

    useEffect(() => {
        if (!armyPhase && state) drawScene(canvasRef.current, state, hoveredHex);
    }, [state, hoveredHex, armyPhase]);

    useEffect(() => {
        if (!diceAnim || diceAnim.done) return;
        const { log, phase, dice } = diceAnim;
        const entry = log[phase];
        if (!entry) {
            setDiceAnim(a => ({ ...a, done: true }));
            setState(s => applyDamage(s, diceAnim));
            return;
        }
        const rolls = entry.rolls || [];
        if (rolls.length === 0 || dice >= rolls.length) {
            const delay = entry.isSummary ? 800 : 600;
            const timer = setTimeout(() => setDiceAnim(a => ({ ...a, phase: a.phase + 1, dice: 0 })), delay);
            return () => clearTimeout(timer);
        }
        const timer = setTimeout(() => setDiceAnim(a => ({ ...a, dice: a.dice + 1 })), 350);
        return () => clearTimeout(timer);
    }, [diceAnim]);

    useEffect(() => {
        const hasDying = state?.dyingUnits?.length > 0;
        const hasPreview = !!state?.aiPreview;
        if (!state || (!hasDying && !hasPreview)) return;
        let frameId;
        const animate = () => {
            drawScene(canvasRef.current, state, hoveredHex);
            if (hasDying) {
                const now = Date.now();
                const stillAnimating = state.dyingUnits.some(d => now - d.deathTime < DEATH_ANIM_DURATION);
                if (!stillAnimating) {
                    setState(s => ({ ...s, dyingUnits: [] }));
                    return;
                }
            }
            frameId = requestAnimationFrame(animate);
        };
        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [state?.dyingUnits, state?.aiPreview]);

    useEffect(() => {
        if (state && state.autoEndTurn) {
            const timer = setTimeout(() => endTurn(), 1200);
            return () => clearTimeout(timer);
        }
    }, [state?.autoEndTurn]);

    useEffect(() => {
        if (!vsAI || !state || state.currentPlayer !== 2 || state.winner) return;
        if (state.autoEndTurn) return;
        if (diceAnim && !diceAnim.done) return;
        const action = computeAIAction(state);
        if (!action) return;

        const preview = !state.aiPreview ? buildAIPreview(state, action) : null;
        if (preview) {
            setState(s => ({ ...s, aiPreview: preview }));
            return;
        }

        const timer = setTimeout(() => {
            if (state.aiPreview) setState(s => ({ ...s, aiPreview: null }));
            if (action.type === "click") setState(prev => handleClick(prev, action.hex));
            else if (action.type === "weapon") selectWeapon(action.weapon);
            else if (action.type === "endTurn") endTurn();
        }, state.aiPreview ? 800 : 1000);
        return () => clearTimeout(timer);
    }, [state, vsAI, diceAnim]);

    function onCanvasClick(e) {
        if (vsAI && state?.currentPlayer === 2) return;
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

    function startMove() { setState(computeMove); }
    function startAttack() { setState(computeAttack); }

    function selectWeapon(weapon) {
        setState(s => {
            const result = computeWeaponSelect(s, weapon);
            if (!result) return s;
            if (result.anim) setDiceAnim(result.anim);
            return result.state;
        });
    }

    function endTurn() { setState(computeEndTurn); }
    function restart() { resetUID(); setSelections({ 1: [], 2: [] }); setArmyPhase(true); setState(null); setVsAI(false); setFairTowns(true); }

    function addUnit(player, type) {
        setSelections(prev => {
            if (prev[player].length >= ARMY_SIZE) return prev;
            return { ...prev, [player]: [...prev[player], type] };
        });
    }

    function removeUnit(player, index) {
        setSelections(prev => ({
            ...prev,
            [player]: prev[player].filter((_, i) => i !== index),
        }));
    }

    function randomArmy(player) {
        const army = Array.from({ length: ARMY_SIZE }, () => UNIT_TYPES[Math.floor(Math.random() * UNIT_TYPES.length)]);
        setSelections(prev => ({ ...prev, [player]: army }));
    }

    function startGame() {
        resetUID();
        setState(initState(selections, { fairTowns }));
        setArmyPhase(false);
    }

    const canStart = selections[1].length === ARMY_SIZE && selections[2].length === ARMY_SIZE;

    const P = { 1: "#2a6fa8", 2: "#a03030" };

    if (showGuide) {
        return <Guide onBack={() => setShowGuide(false)} />;
    }

    if (armyPhase) {
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f5f0e8", color: "#2a2015", fontFamily: "'Crimson Text', Georgia, serif", gap: 32 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 700, letterSpacing: ".2em", color: "#8a6a08" }}>
                    ⚔ SÉLECTION D'ARMÉE ⚔
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button className={`btn ${!vsAI ? "btn-gold" : "btn-grey"}`} onClick={() => { setVsAI(false); setSelections(prev => ({ ...prev, 2: [] })); }} style={{ width: "auto", padding: "8px 20px" }}>
                        2 Joueurs
                    </button>
                    <button className={`btn ${vsAI ? "btn-gold" : "btn-grey"}`} onClick={() => { setVsAI(true); randomArmy(2); }} style={{ width: "auto", padding: "8px 20px" }}>
                        vs IA
                    </button>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button className={`btn ${fairTowns ? "btn-gold" : "btn-grey"}`} onClick={() => setFairTowns(true)} style={{ width: "auto", padding: "8px 20px" }}>
                        Villes équitables
                    </button>
                    <button className={`btn ${!fairTowns ? "btn-gold" : "btn-grey"}`} onClick={() => setFairTowns(false)} style={{ width: "auto", padding: "8px 20px" }}>
                        Villes aléatoires
                    </button>
                </div>
                <div style={{ display: "flex", gap: 48 }}>
                    {[1, 2].map(player => {
                        const isAIPlayer = vsAI && player === 2;
                        return (
                        <div key={player} style={{ width: 320, border: `2px solid ${P[player]}`, borderRadius: 6, padding: 20, background: "#ece5d8", opacity: isAIPlayer ? 0.5 : 1, pointerEvents: isAIPlayer ? "none" : "auto" }}>
                            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 16, fontWeight: 700, color: P[player], marginBottom: 14, textAlign: "center" }}>
                                {isAIPlayer ? "IA" : `JOUEUR ${player}`} ({selections[player].length}/{ARMY_SIZE})
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                                {UNIT_TYPES.map(type => {
                                    const t = UNIT_TEMPLATES[type];
                                    const full = selections[player].length >= ARMY_SIZE;
                                    return (
                                        <button key={type} className={`btn ${full ? "btn-grey" : "btn-blue"}`} disabled={full} onClick={() => addUnit(player, type)} style={{ textAlign: "left" }}>
                                            {t.symbol} {t.name}
                                        </button>
                                    );
                                })}
                                <button className="btn btn-gold" onClick={() => randomArmy(player)} style={{ marginTop: 6, width: "100%" }}>
                                    🎲 Aléatoire
                                </button>
                            </div>
                            <div style={{ borderTop: "1px solid #d5cbb8", paddingTop: 10 }}>
                                {selections[player].length === 0 ? (
                                    <div style={{ color: "#a09080", fontSize: 13, fontStyle: "italic" }}>Aucune unité sélectionnée</div>
                                ) : (
                                    selections[player].map((type, i) => {
                                        const t = UNIT_TEMPLATES[type];
                                        return (
                                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, padding: "3px 0" }}>
                                                <span>{t.symbol} {t.name}</span>
                                                <button onClick={() => removeUnit(player, i)} style={{ background: "none", border: "none", color: "#a03030", cursor: "pointer", fontSize: 16 }}>✕</button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        );
                    })}
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <button className="btn btn-gold" disabled={!canStart} onClick={startGame} style={{ fontSize: 17, padding: "12px 36px" }}>
                        ⚔ Lancer la partie
                    </button>
                    <button className="btn btn-grey" onClick={() => setShowGuide(true)} style={{ fontSize: 17, padding: "12px 28px" }}>
                        ? Guide
                    </button>
                </div>
            </div>
        );
    }

    const sel = state.selectedUnit ? state.units.find(u => u.id === state.selectedUnit.id) : null;
    const phaseLabel = {
        select: "SÉLECTION", move: "MOUVEMENT", attack: "ATTAQUE", weapon_select: "CHOIX D'ARME", resolving: "RÉSOLUTION",
    }[state.phase] || "";

    return (
        <div style={{ display: "flex", height: "100vh", background: "#f5f0e8", color: "#2a2015", fontFamily: "'Crimson Text', Georgia, serif", overflow: "hidden" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 20 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 24, fontWeight: 700, letterSpacing: ".2em", color: "#8a6a08", textShadow: "0 0 30px rgba(138,106,8,.2)" }}>
                    ⚔ WARHEX ⚔
                </div>

                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    style={{ border: "1px solid #c8b898", maxWidth: "100%" }}
                    onClick={onCanvasClick}
                    onMouseMove={onMouseMove}
                    onMouseLeave={() => setHoveredHex(null)}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: CANVAS_W, width: "100%", marginTop: 6 }}>
                    <div style={{
                        background: "#ece5d8", border: `1px solid ${P[state.currentPlayer]}`,
                        padding: "6px 14px", fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: ".1em",
                        color: P[state.currentPlayer], borderRadius: 3,
                    }}>
                        {state.winner ? (state.winner === "draw" ? "⚖ ÉGALITÉ" : `🏆 JOUEUR ${state.winner} VICTORIEUX`) : `J${state.currentPlayer} — ${phaseLabel} · ⚡${ACTIVATIONS_PER_TURN - state.activationsUsed}`}
                    </div>
                    <div style={{ background: "#ece5d8", border: "1px solid #c8b898", padding: "6px 12px", fontFamily: "'Cinzel', serif", fontSize: 12, color: "#8a7a60", display: "flex", gap: 12, alignItems: "center", borderRadius: 3 }}>
                        <span style={{ color: "#2a6fa8" }}>{state.scores[1]} pts</span>
                        <span>TOUR {state.round}/7</span>
                        <span style={{ color: "#a03030" }}>{state.scores[2]} pts</span>
                    </div>
                </div>
            </div>

            <div style={{ width: 320, borderLeft: "1px solid #d5cbb8", background: "#ece5d8", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #d5cbb8", minHeight: 210 }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 12 }}>UNITÉ SÉLECTIONNÉE</div>
                    {sel ? (
                        <>
                            <div style={{ fontSize: 17, fontWeight: 600, color: P[sel.player], marginBottom: 2 }}>{sel.symbol} {sel.name}</div>
                            <div style={{ fontSize: 13, color: "#8a7a60", marginBottom: 10 }}>Joueur {sel.player}</div>
                            <div style={{ borderTop: "1px solid #d5cbb8", paddingTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
                                {[
                                    ["PV (points de vie)", `${sel.currentWounds}/${sel.wounds}`, sel.currentWounds > sel.wounds / 2 ? "#4caf50" : "#e53935"],
                                    ["MVT (mouvement)", sel.movement], ["CC (capacité combat)", `${sel.weaponSkill}+`], ["CT (capacité tir)", `${sel.ballisticSkill}+`],
                                    ["SVG (sauvegarde)", `${sel.save}+`],
                                    ["Déplacé", sel.hasMoved ? "✓" : "—"], ["Attaqué", sel.hasAttacked ? "✓" : "—"],
                                ].map(([label, val, c]) => (
                                    <div key={label} className="sr">
                                        <span className="sl">{label}</span>
                                        <span className="sv" style={c ? { color: c } : {}}>{val}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ borderTop: "1px solid #d5cbb8", paddingTop: 10, marginTop: 6 }}>
                                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 6 }}>ARMES</div>
                                {sel.weapons.map(w => (
                                    <div key={w.id} style={{ fontSize: 13, color: "#3a3020", marginBottom: 8, padding: "6px 8px", background: "#ece6da", borderRadius: 4 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 3 }}>{w.name} <span style={{ color: "#8a7a60", fontWeight: 400 }}>({w.type === "ranged" ? "tir" : "mêlée"})</span></div>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "#5a5040" }}>
                                            <span>Portée : {w.range}</span>
                                            <span>ATQ : {w.attacks}</span>
                                            <span>PA : {w.ap}</span>
                                            <span>DGT : {w.damage}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div style={{ color: "#a09080", fontSize: 14, fontStyle: "italic" }}>Cliquez sur une de vos unités pour la sélectionner.</div>
                    )}
                </div>

                <div style={{ padding: "16px 20px", borderBottom: "1px solid #d5cbb8" }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 12 }}>ACTIONS</div>

                    {state.phase === "weapon_select" && state.pendingAttack ? (
                        <>
                            <div style={{ fontSize: 14, color: "#8a6a08", marginBottom: 10 }}>
                                Attaquer <strong>{state.pendingAttack.target.name}</strong> avec :
                            </div>
                            {state.pendingAttack.attacker.weapons.map(w => {
                                const dist = hexDistance(state.pendingAttack.attacker.hex, state.pendingAttack.target.hex);
                                const hillKeys = new Set((state.hills || []).map(hexKey));
                                const rangeBonus = (w.type === "ranged" && hillKeys.has(hexKey(state.pendingAttack.attacker.hex))) ? 1 : 0;
                                const ok = dist <= w.range + rangeBonus;
                                const target = state.pendingAttack.target;
                                const townKeys = new Set((state.towns || []).map(hexKey));
                                const inTown = townKeys.has(hexKey(target.hex));
                                const effectiveSave = target.save - (inTown ? 1 : 0) + Math.abs(w.ap);
                                const cantSave = effectiveSave > 6;
                                const saveColor = cantSave ? "#2e7d32" : effectiveSave >= 6 ? "#558b2f" : effectiveSave >= 4 ? "#8a7a60" : effectiveSave >= 3 ? "#e65100" : "#c62828";
                                const attacker = state.pendingAttack.attacker;
                                const skill = w.type === "ranged" ? attacker.ballisticSkill : attacker.weaponSkill;
                                return (
                                    <button key={w.id} className={`weapon-card${ok ? "" : " disabled"}${state.aiPreview?.type === "weapon" && state.aiPreview.weapon.id === w.id ? " ai-highlight" : ""}`} onClick={() => ok && selectWeapon(w)}>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{w.name} {w.type === "ranged" ? "🏹" : "🗡"}</div>
                                        {!ok ? (
                                            <div style={{ fontSize: 12, color: "#b0a090", marginTop: 4 }}>
                                                {w.type === "ranged" ? `Portée ${w.range + rangeBonus}` : "Mêlée (adjacent)"} · Trop loin ({dist} hex)
                                            </div>
                                        ) : (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6, fontSize: 12, color: "#6a5a40" }}>
                                                <div>{w.type === "ranged" ? `Portée ${w.range + rangeBonus} hex${rangeBonus ? " ⛰" : ""}` : "Mêlée (adjacent)"} · Distance : {dist}</div>
                                                <div>Touche sur {skill}+ · {w.attacks} {w.attacks > 1 ? "attaques" : "attaque"}</div>
                                                <div>{w.damage} {w.damage > 1 ? "dégâts" : "dégât"} par touche · Pénétration {Math.abs(w.ap)}</div>
                                                <div style={{ color: saveColor, fontWeight: 600, marginTop: 2 }}>
                                                    {cantSave ? "Sauvegarde impossible" : `Sauvegarde ennemie sur ${effectiveSave}+`}{inTown ? " 🏰 (couvert)" : ""}
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                            <button className="btn btn-grey" onClick={() => setState(s => ({ ...s, phase: "select", pendingAttack: null, validTargets: [], validMoves: [] }))}>✕ Annuler</button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-blue" disabled={!sel || sel.hasMoved || state.phase === "attack" || (vsAI && state.currentPlayer === 2)} onClick={startMove}>⟶ Déplacer</button>
                            <button className="btn btn-red" disabled={!sel || sel.hasAttacked || (vsAI && state.currentPlayer === 2)} onClick={startAttack}>⚔ Attaquer</button>
                            {sel && <button className="btn btn-grey" onClick={() => setState(computeDeselect)}>✕ Désélectionner</button>}
                            <div style={{ borderTop: "1px solid #d5cbb8", marginTop: 6, paddingTop: 8 }}>
                                <button className="btn btn-gold" disabled={!!state.winner || (vsAI && state.currentPlayer === 2)} onClick={endTurn}>⏭ Fin de tour</button>
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
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid #d5cbb8", background: "#e5ddd0" }}>
                            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 10 }}>RÉSOLUTION DE COMBAT</div>
                            <div style={{ fontSize: 14, color: "#8a6a08", marginBottom: 8 }}>
                                {atkName} → {tgtName} [{wpnName}]
                            </div>
                            {visibleLog.map((entry, i) => {
                                const isCurrentPhase = animating && i === src.phase;
                                const visibleDice = isCurrentPhase ? (entry.rolls || []).slice(0, src.dice) : (entry.rolls || []);
                                return (
                                    <div key={i} style={{ marginBottom: entry.isSummary ? 0 : 6 }}>
                                        <div style={{ fontSize: 13, color: "#6a5a40", marginBottom: visibleDice.length ? 3 : 0 }}>{entry.label}</div>
                                        {visibleDice.length > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
                                                {visibleDice.map((r, j) => {
                                                    const needed = entry.isSave
                                                        ? parseInt((entry.label.match(/(\d+)\+/) || [0, 7])[1])
                                                        : parseInt((entry.label.match(/(\d+)\+/) || [0, 0])[1]);
                                                    const hit = r >= needed;
                                                    const cls = entry.isSave ? (hit ? "roll-save" : "roll-save-fail") : (hit ? "roll-hit" : "roll-miss");
                                                    const isNew = isCurrentPhase && j === src.dice - 1;
                                                    return <span key={j} className={`roll-chip ${cls}${isNew ? " roll-new" : ""}`}>{r}</span>;
                                                })}
                                            </div>
                                        )}
                                        {entry.isSummary && !animating && (
                                            <div style={{ fontSize: 14, fontWeight: 600, color: src.damage > 0 ? "#e53935" : "#4caf50", marginTop: 6 }}>
                                                {src.isDead ? `💀 ${tgtName} éliminé !` : `${src.damage} dégât(s) infligé(s)`}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {animating && (
                                <div style={{ fontSize: 13, color: "#8a7a60", marginTop: 8, fontStyle: "italic", animation: "pulse 1s infinite" }}>
                                    Lancement des dés...
                                </div>
                            )}
                        </div>
                    );
                })()}

            </div>
        </div>
    );
}
