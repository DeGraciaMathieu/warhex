import { useState, useEffect, useRef, Fragment } from "react";
import { hexToPixel, pixelToHex, hexDistance, hexKey, isValidHex, HEX_SIZE } from "./hex.js";
import { initState, resetUID, UNIT_TEMPLATES, ACTIVATIONS_PER_TURN, ROUNDS_PER_GAME, turnSchedule, currentTurnIndex, roundGains, TERRAIN_DENSITY_LABELS, DEFAULT_TERRAIN_DENSITY, TERRAIN_PRESETS, computeTownControl } from "./units.js";
import { drawScene, CANVAS_W, CANVAS_H, OX, OY, DEATH_ANIM_DURATION, HIT_EFFECT_DURATION, ATTACK_EFFECT_DURATION, moveAnimDuration } from "./renderer.js";
import { handleClick, computeMove, computeAttack, computeWeaponSelect, applyDamage, computeEndTurn, computeDeselect, computeConsolidate, computeCancelAttack, unitAt, getSaveModifier, getRangeModifier, getCombatModifiers } from "./game.js";
import { computeAIAction, buildAIPreview } from "./ai.js";
import { hostGame, joinGame, generateCode, normalizeCode, isValidCode, onlinePlayerNumber, isNotMyTurn, shouldApplyDamage, applyOnlineMessage } from "./online.js";
import { setupSteps, nextSetupStep, canAdvanceFromMode } from "./setup.js";
import Guide from "./Guide.jsx";
import "./styles.css";

const UNIT_TYPES = Object.keys(UNIT_TEMPLATES);

const STEP_META = {
    mode:    { label: "Mode",    title: "Mode de jeu",            desc: "Affrontez un ami en local, défiez l'IA, ou jouez à distance." },
    terrain: { label: "Terrain", title: "Champ de bataille",      desc: "Réglez le terrain et prévisualisez la carte avant le combat." },
    armies:  { label: "Armées",  title: "Composition des armées", desc: "Choisissez 5 unités par camp, puis lancez la partie." },
};

const W = 260, H = 140, PAD_X = 30, PAD_Y = 20;
const CHART_W = W - PAD_X * 2, CHART_H = H - PAD_Y * 2;

// Réglages de la frise des tours (PRD 10).
const BUBBLE_SIZE = 20, BUBBLE_GAP = 6, ROUND_GAP = 14, SCORE_FX_DURATION = 900;

function ScoreChart({ scoreHistory }) {
    const maxScore = Math.max(...scoreHistory.map(h => Math.max(h.scores[1], h.scores[2])), 1);
    const pts = (player) => scoreHistory.map((h, i) => {
        const x = PAD_X + (i / (scoreHistory.length - 1 || 1)) * CHART_W;
        const y = PAD_Y + CHART_H - (h.scores[player] / maxScore) * CHART_H;
        return `${x},${y}`;
    }).join(" ");
    return (
        <div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 6 }}>ÉVOLUTION DES POINTS</div>
            <svg width={W} height={H} style={{ background: "#f5f0e8", borderRadius: 4, border: "1px solid #d5cbb8" }}>
                {[...Array(Math.min(5, maxScore + 1))].map((_, i) => {
                    const y = PAD_Y + CHART_H - (i / Math.min(4, maxScore)) * CHART_H;
                    const val = Math.round(i * maxScore / Math.min(4, maxScore));
                    return <g key={i}>
                        <line x1={PAD_X} y1={y} x2={PAD_X + CHART_W} y2={y} stroke="#d5cbb8" strokeWidth="0.5" />
                        <text x={PAD_X - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#8a7a60">{val}</text>
                    </g>;
                })}
                {scoreHistory.map((h, i) => {
                    const x = PAD_X + (i / (scoreHistory.length - 1 || 1)) * CHART_W;
                    return <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#8a7a60">T{h.round}</text>;
                })}
                <polyline points={pts(1)} fill="none" stroke="#2a6fa8" strokeWidth="2" />
                <polyline points={pts(2)} fill="none" stroke="#a03030" strokeWidth="2" />
                {scoreHistory.map((h, i) => {
                    const x = PAD_X + (i / (scoreHistory.length - 1 || 1)) * CHART_W;
                    const y1 = PAD_Y + CHART_H - (h.scores[1] / maxScore) * CHART_H;
                    const y2 = PAD_Y + CHART_H - (h.scores[2] / maxScore) * CHART_H;
                    return <g key={i}>
                        <circle cx={x} cy={y1} r="3" fill="#2a6fa8" />
                        <circle cx={x} cy={y2} r="3" fill="#a03030" />
                    </g>;
                })}
            </svg>
        </div>
    );
}

function WeaponCard({ weapon, attacker, target, hills, towns, aiPreview, onSelect }) {
    const dist = hexDistance(attacker.hex, target.hex);
    const hillKeys = new Set((hills || []).map(hexKey));
    const rangeBonus = (weapon.type === "ranged" && hillKeys.has(hexKey(attacker.hex))) ? 1 : 0;
    const tooClose = dist < (weapon.minRange || 1);
    const ok = !tooClose && dist <= weapon.range + rangeBonus;
    const townKeys = new Set((towns || []).map(hexKey));
    const inTown = townKeys.has(hexKey(target.hex));
    const effectiveSave = target.save - (inTown ? 1 : 0) + Math.abs(weapon.ap);
    const cantSave = effectiveSave > 6;
    const saveColor = cantSave ? "#2e7d32" : effectiveSave >= 6 ? "#558b2f" : effectiveSave >= 4 ? "#8a7a60" : effectiveSave >= 3 ? "#e65100" : "#c62828";
    const skill = weapon.type === "ranged" ? attacker.ballisticSkill : attacker.weaponSkill;
    const isAIHighlight = aiPreview?.type === "weapon" && aiPreview.weapon.id === weapon.id;

    return (
        <button className={`weapon-card${ok ? "" : " disabled"}${isAIHighlight ? " ai-highlight" : ""}`} onClick={() => ok && onSelect(weapon)}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{weapon.name} {weapon.type === "ranged" ? "🏹" : "🗡"}</div>
            {!ok ? (
                <div style={{ fontSize: 12, color: "#b0a090", marginTop: 4 }}>
                    {weapon.type === "ranged" ? `Portée ${weapon.minRange ? `${weapon.minRange}-` : ""}${weapon.range + rangeBonus}` : "Mêlée (adjacent)"} · {tooClose ? "Trop proche" : "Trop loin"} ({dist} hex)
                </div>
            ) : (
                <div style={{ marginTop: 6 }}>
                    <div className="weapon-stats">
                        <div className="weapon-stat">
                            <div className="weapon-stat-label">ATQ</div>
                            <div className="weapon-stat-value">{weapon.attacks}</div>
                        </div>
                        <div className="weapon-stat">
                            <div className="weapon-stat-label">TC</div>
                            <div className="weapon-stat-value">{skill}+</div>
                        </div>
                        <div className="weapon-stat">
                            <div className="weapon-stat-label">DÉG</div>
                            <div className="weapon-stat-value">{weapon.damage}</div>
                        </div>
                        <div className="weapon-stat">
                            <div className="weapon-stat-label">PA</div>
                            <div className="weapon-stat-value">-{Math.abs(weapon.ap)}</div>
                        </div>
                    </div>
                    <div className="weapon-save" style={{ color: saveColor }}>
                        {cantSave ? "Sauvegarde impossible" : `Sauvegarde ennemie : ${effectiveSave}+`}{inTown ? " 🏰" : ""}
                    </div>
                </div>
            )}
        </button>
    );
}

const ARMY_SIZE = 5;
// Délai (ms) avant l'apparition du tooltip d'unité (hover intent) : évite que le
// tooltip clignote quand le curseur ne fait que traverser le plateau.
const TOOLTIP_DELAY = 500;

export default function HexWarhammer() {
    const canvasRef = useRef(null);
    const [armyPhase, setArmyPhase] = useState(true);
    const [setupStep, setSetupStep] = useState("mode");
    const [showGuide, setShowGuide] = useState(false);
    const [vsAI, setVsAI] = useState(false);
    const [fairTowns, setFairTowns] = useState(true);
    const [terrainDensity, setTerrainDensity] = useState(DEFAULT_TERRAIN_DENSITY);
    const [previewState, setPreviewState] = useState(null);
    const previewCanvasRef = useRef(null);
    const [selections, setSelections] = useState({ 1: [], 2: [] });
    const [state, setState] = useState(null);
    const [hoveredHex, setHoveredHex] = useState(null);
    const [tooltipPos, setTooltipPos] = useState(null);
    const [tooltipUnitId, setTooltipUnitId] = useState(null);
    const [diceAnim, setDiceAnim] = useState(null);
    const [pendingDamage, setPendingDamage] = useState(null);
    const [scoreFx, setScoreFx] = useState(null);
    const prevScoreLen = useRef(0);
    const [online, setOnline] = useState(null);
    const [joinCode, setJoinCode] = useState("");
    const peerRef = useRef(null);
    const connRef = useRef(null);

    const myPlayer = onlinePlayerNumber(online);
    const notMyTurn = isNotMyTurn(state, online, myPlayer);

    function sendMsg(msg) {
        const conn = connRef.current;
        if (conn?.open) conn.send(msg);
    }

    function applyAction(fn) {
        setState(prev => {
            const next = fn(prev);
            if (online && next !== prev) sendMsg({ type: "state", state: next });
            return next;
        });
    }

    function handleMessage(msg) {
        const effects = applyOnlineMessage(msg);
        if (!effects) return;
        if (effects.armySelection) setSelections(prev => ({ ...prev, [effects.armySelection.player]: effects.armySelection.selections }));
        if (effects.state) setState(effects.state);
        if (effects.startGame) setArmyPhase(false);
        if (effects.diceAnim) setDiceAnim(effects.diceAnim);
    }

    function peerHandlers() {
        return {
            onConnect: conn => { connRef.current = conn; setOnline(o => o && { ...o, status: "connected" }); },
            onMessage: handleMessage,
            onDisconnect: () => { connRef.current = null; setOnline(o => o && { ...o, status: "left" }); },
            onError: () => setOnline(o => o && (o.status === "connected" ? { ...o, status: "left" } : { ...o, status: "error" })),
        };
    }

    function createOnlineGame() {
        const code = generateCode();
        setOnline({ role: "host", code, status: "waiting" });
        peerRef.current = hostGame(code, peerHandlers());
    }

    function joinOnlineGame() {
        const code = normalizeCode(joinCode);
        if (!isValidCode(code)) return;
        setOnline({ role: "guest", code, status: "connecting" });
        peerRef.current = joinGame(code, peerHandlers());
    }

    function quitOnline() {
        peerRef.current?.destroy();
        peerRef.current = null;
        connRef.current = null;
        setOnline(null);
        setJoinCode("");
    }

    function backToOnlineMenu() {
        peerRef.current?.destroy();
        peerRef.current = null;
        connRef.current = null;
        setOnline({ role: null, status: "menu" });
        setJoinCode("");
    }

    useEffect(() => () => peerRef.current?.destroy(), []);

    const mySelections = online && myPlayer ? selections[myPlayer] : null;
    useEffect(() => {
        if (!armyPhase || !mySelections || online?.status !== "connected") return;
        sendMsg({ type: "army", player: myPlayer, selections: mySelections });
    }, [mySelections, online?.status, armyPhase]);

    useEffect(() => {
        if (!armyPhase && state) drawScene(canvasRef.current, state, hoveredHex);
    }, [state, hoveredHex, armyPhase]);

    // Animation de gain : déclenchée quand une nouvelle entrée apparaît dans
    // scoreHistory (donc à chaque fin de round), pilotée par l'état — fonctionne
    // donc aussi pour les tours IA / l'adversaire en ligne. On ignore les gains nuls.
    const scoreHistory = state?.scoreHistory ?? [];
    useEffect(() => {
        const len = scoreHistory.length;
        const grew = len > prevScoreLen.current;
        prevScoreLen.current = len;
        if (!grew) return;
        const gains = roundGains(scoreHistory);
        const last = gains[gains.length - 1];
        if (last.gain[1] <= 0 && last.gain[2] <= 0) return;
        setScoreFx(last);
        const id = setTimeout(() => setScoreFx(null), SCORE_FX_DURATION);
        return () => clearTimeout(id);
    }, [scoreHistory]);

    // Hover intent : le tooltip n'apparaît qu'après un court délai passé sur la
    // même unité. La dépendance porte sur l'id de l'unité survolée (et non sur la
    // position) : le timer n'est réarmé que lorsqu'on change réellement d'unité.
    const hoveredUnitId = (state && hoveredHex) ? (unitAt(state.units, hoveredHex)?.id ?? null) : null;
    useEffect(() => {
        if (hoveredUnitId == null) { setTooltipUnitId(null); return; }
        const timer = setTimeout(() => setTooltipUnitId(hoveredUnitId), TOOLTIP_DELAY);
        return () => clearTimeout(timer);
    }, [hoveredUnitId]);

    function regeneratePreview() {
        resetUID();
        const s = initState(selections, { fairTowns, terrainDensity });
        setPreviewState({ obstacles: s.obstacles, rivers: s.rivers, towns: s.towns, forests: s.forests, hills: s.hills, swamps: s.swamps, units: [], validMoves: [], validTargets: [], attackRangeHexes: [], townOwnership: {}, dyingUnits: [], hitEffects: [], aiPreview: null });
    }

    useEffect(() => {
        if (armyPhase) regeneratePreview();
    }, [terrainDensity, fairTowns]);

    useEffect(() => {
        if (armyPhase && previewState && previewCanvasRef.current) drawScene(previewCanvasRef.current, previewState, null);
    }, [previewState, armyPhase, online?.role, setupStep]);

    // Une déconnexion / erreur survenue après l'étape Mode ramène au début du flux.
    useEffect(() => {
        if (!armyPhase || setupStep === "mode") return;
        if (online?.status === "left" || online?.status === "error") setSetupStep("mode");
    }, [online?.status, armyPhase, setupStep]);

    useEffect(() => {
        if (!diceAnim || diceAnim.done) return;
        const { log, phase, dice, rolling } = diceAnim;
        const entry = log[phase];
        if (!entry) {
            setDiceAnim(a => ({ ...a, done: true }));
            return;
        }
        const rolls = entry.rolls || [];
        if (rolls.length === 0 || dice >= rolls.length) {
            const delay = entry.isSummary ? 800 : 600;
            const timer = setTimeout(() => setDiceAnim(a => ({ ...a, phase: a.phase + 1, dice: 0, rolling: false })), delay);
            return () => clearTimeout(timer);
        }
        if (!rolling) {
            setDiceAnim(a => ({ ...a, rolling: true }));
            return;
        }
        const timer = setTimeout(() => setDiceAnim(a => ({ ...a, dice: a.dice + 1, rolling: false })), 450);
        return () => clearTimeout(timer);
    }, [diceAnim]);

    useEffect(() => {
        const hasDying = state?.dyingUnits?.length > 0;
        const hasPreview = !!state?.aiPreview;
        const hasHitEffects = state?.hitEffects?.length > 0;
        const hasAttackEffects = state?.attackEffects?.length > 0;
        const hasMoving = !!state?.movingUnit;
        if (!state || (!hasDying && !hasPreview && !hasHitEffects && !hasAttackEffects && !hasMoving)) return;
        let frameId;
        const animate = () => {
            drawScene(canvasRef.current, state, hoveredHex);
            const now = Date.now();
            const dyingDone = !hasDying || !state.dyingUnits.some(d => now - d.deathTime < DEATH_ANIM_DURATION);
            const hitDone = !hasHitEffects || !state.hitEffects.some(e => now - e.time < HIT_EFFECT_DURATION);
            const attackDone = !hasAttackEffects || !state.attackEffects.some(e => now - e.time < ATTACK_EFFECT_DURATION);
            const movingDone = !hasMoving || now - state.movingUnit.time >= moveAnimDuration(state.movingUnit.path);
            if (dyingDone && hitDone && attackDone && movingDone && !hasPreview) {
                setState(s => ({ ...s, dyingUnits: [], hitEffects: [], attackEffects: [], movingUnit: null }));
                return;
            }
            frameId = requestAnimationFrame(animate);
        };
        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [state?.dyingUnits, state?.aiPreview, state?.hitEffects, state?.attackEffects, state?.movingUnit]);

    function closeCombatModal() {
        if (!diceAnim) return;
        if (shouldApplyDamage(diceAnim, online, myPlayer)) setPendingDamage(diceAnim);
        setDiceAnim(null);
    }

    useEffect(() => {
        if (!pendingDamage) return;
        const timer = setTimeout(() => {
            applyAction(s => applyDamage(s, pendingDamage));
            setPendingDamage(null);
        }, 400);
        return () => clearTimeout(timer);
    }, [pendingDamage]);

    useEffect(() => {
        if (!diceAnim?.done) return;
        const timer = setTimeout(() => closeCombatModal(), 2000);
        return () => clearTimeout(timer);
    }, [diceAnim?.done]);

    useEffect(() => {
        if (state && state.autoEndTurn) {
            if (notMyTurn) return;
            const timer = setTimeout(() => endTurn(), 1200);
            return () => clearTimeout(timer);
        }
    }, [state?.autoEndTurn]);

    useEffect(() => {
        if (!vsAI || !state || state.currentPlayer !== 2 || state.winner) return;
        if (state.autoEndTurn) return;
        if (state.movingUnit) return;
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
            else if (action.type === "consolidate") applyAction(s => computeConsolidate(s, action.accept));
            else if (action.type === "endTurn") endTurn();
        }, state.aiPreview ? 800 : 1000);
        return () => clearTimeout(timer);
    }, [state, vsAI, diceAnim]);

    function onCanvasClick(e) {
        if (vsAI && state?.currentPlayer === 2) return;
        if (notMyTurn) return;
        if (state?.movingUnit) return;
        if (diceAnim && !diceAnim.done) return;
        if (diceAnim?.done) closeCombatModal();
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = CANVAS_W / rect.width, sy = CANVAS_H / rect.height;
        const x = (e.clientX - rect.left) * sx - OX;
        const y = (e.clientY - rect.top) * sy - OY;
        const hex = pixelToHex(x, y);
        if (!isValidHex(hex)) return;
        applyAction(prev => handleClick(prev, hex));
    }

    function onMouseMove(e) {
        const rect = canvasRef.current.getBoundingClientRect();
        const sx = CANVAS_W / rect.width, sy = CANVAS_H / rect.height;
        const x = (e.clientX - rect.left) * sx - OX;
        const y = (e.clientY - rect.top) * sy - OY;
        const hex = pixelToHex(x, y);
        setHoveredHex(isValidHex(hex) ? hex : null);
        setTooltipPos({ x: e.clientX, y: e.clientY });
    }

    // Position écran (viewport) du centre d'un hexe, en tenant compte de
    // l'échelle d'affichage du canvas (maxWidth 100%).
    function hexScreenPos(hex) {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scale = rect.width / CANVAS_W;
        const px = hexToPixel(hex.q, hex.r);
        return { x: rect.left + (OX + px.x) * scale, y: rect.top + (OY + px.y) * scale, scale };
    }

    function startMove() { applyAction(computeMove); }
    function startAttack() { applyAction(computeAttack); }

    function selectWeapon(weapon) {
        if (notMyTurn) return;
        setState(s => {
            const result = computeWeaponSelect(s, weapon);
            if (!result) return s;
            if (result.anim) setDiceAnim(result.anim);
            if (online) sendMsg(result.anim ? { type: "combat", state: result.state, anim: result.anim } : { type: "state", state: result.state });
            return result.state;
        });
    }

    function endTurn() { applyAction(computeEndTurn); }
    function restart() { quitOnline(); resetUID(); setSelections({ 1: [], 2: [] }); setArmyPhase(true); setSetupStep("mode"); setState(null); setVsAI(false); setFairTowns(true); setTerrainDensity(DEFAULT_TERRAIN_DENSITY); }

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

    function setDensity(terrain, value) {
        setTerrainDensity(prev => ({ ...prev, [terrain]: value }));
    }

    function startGame() {
        resetUID();
        // Réutilise le terrain de la preview pour que la carte jouée soit
        // exactement celle prévisualisée à l'étape précédente.
        const terrain = previewState
            ? { obstacles: previewState.obstacles, rivers: previewState.rivers, towns: previewState.towns, forests: previewState.forests, hills: previewState.hills, swamps: previewState.swamps }
            : undefined;
        const s = initState(selections, { fairTowns, terrainDensity, terrain });
        if (online) sendMsg({ type: "start", state: s });
        setState(s);
        setArmyPhase(false);
    }

    const canStart = selections[1].length === ARMY_SIZE && selections[2].length === ARMY_SIZE;

    const P = { 1: "#2a6fa8", 2: "#a03030" };

    if (showGuide) {
        return <Guide onBack={() => setShowGuide(false)} />;
    }

    if (armyPhase) {
        const renderArmyPanel = (player) => {
            const isAIPlayer = vsAI && player === 2;
            const isRemotePlayer = !!online && player !== myPlayer;
            const locked = isAIPlayer || isRemotePlayer;
            return (
                <div style={{ width: 240, border: `2px solid ${P[player]}`, borderRadius: 6, padding: 16, background: "#ece5d8", opacity: locked ? 0.5 : 1, pointerEvents: locked ? "none" : "auto" }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 700, color: P[player], marginBottom: 12, textAlign: "center" }}>
                        {isAIPlayer ? "IA" : isRemotePlayer ? "ADVERSAIRE" : `JOUEUR ${player}`} ({selections[player].length}/{ARMY_SIZE})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                        {UNIT_TYPES.map(type => {
                            const t = UNIT_TEMPLATES[type];
                            const full = selections[player].length >= ARMY_SIZE;
                            return (
                                <button key={type} className={`btn ${full ? "btn-grey" : player === 1 ? "btn-blue" : "btn-red"}`} disabled={full} onClick={() => addUnit(player, type)} style={{ textAlign: "left", padding: "7px 12px" }}>
                                    {t.symbol} {t.name}
                                </button>
                            );
                        })}
                        <button className="btn btn-gold" onClick={() => randomArmy(player)} style={{ marginTop: 4, width: "100%", padding: "7px 12px" }}>
                            🎲 Aléatoire
                        </button>
                    </div>
                    <div style={{ borderTop: "1px solid #d5cbb8", paddingTop: 8 }}>
                        {selections[player].length === 0 ? (
                            <div style={{ color: "#a09080", fontSize: 13, fontStyle: "italic" }}>Aucune unité sélectionnée</div>
                        ) : (
                            selections[player].map((type, i) => {
                                const t = UNIT_TEMPLATES[type];
                                return (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, padding: "2px 0" }}>
                                        <span>{t.symbol} {t.name}</span>
                                        <button onClick={() => removeUnit(player, i)} style={{ background: "none", border: "none", color: "#a03030", cursor: "pointer", fontSize: 16 }}>✕</button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            );
        };

        const goNext = () => setSetupStep(s => nextSetupStep(s, online));
        const steps = setupSteps(online);
        const currentIndex = steps.indexOf(setupStep);

        const stepFooter = (action) => (
            <div style={{ display: "flex", gap: 12 }}>
                {action}
                <button className="btn btn-grey" onClick={() => setShowGuide(true)} style={{ fontSize: 17, padding: "12px 28px" }}>
                    ? Guide
                </button>
            </div>
        );

        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f0e8", color: "#2a2015", fontFamily: "'Crimson Text', Georgia, serif", gap: 20, padding: "24px 0" }}>
                <div className="home-title">
                    <div className="home-title-line" />
                    <div>
                        <div className="home-title-text">WARHEX</div>
                        <div className="home-title-sub">Tactique hexagonale</div>
                    </div>
                    <div className="home-title-line" />
                </div>

                <div className="steps">
                    {steps.map((s, i) => (
                        <Fragment key={s}>
                            {i > 0 && <div className={`step-connector${i <= currentIndex ? " done" : ""}`} />}
                            <div className={`step ${i === currentIndex ? "active" : i < currentIndex ? "done" : ""}`}>
                                <div className="step-pill">{i + 1}</div>
                                <div className="step-label">{STEP_META[s].label}</div>
                            </div>
                        </Fragment>
                    ))}
                </div>

                <div className="step-header">
                    <div className="step-title">{STEP_META[setupStep].title}</div>
                    <div className="step-desc">{STEP_META[setupStep].desc}</div>
                </div>

                {setupStep === "mode" && <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                        <div className="mode-cards">
                            <button className={`mode-card${!vsAI && !online ? " active" : ""}`} onClick={() => { quitOnline(); setVsAI(false); setSelections(prev => ({ ...prev, 2: [] })); }}>
                                <span className="mode-card-icon">⚔</span>
                                <span className="mode-card-title">2 JOUEURS</span>
                                <span className="mode-card-desc">Deux joueurs sur le même écran, chacun son tour.</span>
                            </button>
                            <button className={`mode-card${vsAI ? " active" : ""}`} onClick={() => { quitOnline(); setVsAI(true); randomArmy(2); }}>
                                <span className="mode-card-icon">🤖</span>
                                <span className="mode-card-title">VS IA</span>
                                <span className="mode-card-desc">Affrontez l'intelligence artificielle.</span>
                            </button>
                            <button className={`mode-card${online ? " active" : ""}`} onClick={() => { if (!online) { setVsAI(false); setSelections({ 1: [], 2: [] }); setOnline({ role: null, status: "menu" }); } }}>
                                <span className="mode-card-icon">🌐</span>
                                <span className="mode-card-title">EN LIGNE</span>
                                <span className="mode-card-desc">Jouez à distance via un code de partie.</span>
                            </button>
                        </div>

                        {online && (
                            <div style={{ background: "#ece5d8", border: "1px solid #d5cbb8", borderRadius: 6, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                                {online.status === "menu" && <>
                                    <button className="btn btn-gold" onClick={createOnlineGame} style={{ width: "auto", padding: "7px 18px", marginBottom: 0 }}>
                                        Créer une partie
                                    </button>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <input
                                            value={joinCode}
                                            onChange={e => setJoinCode(normalizeCode(e.target.value))}
                                            placeholder="CODE"
                                            maxLength={4}
                                            style={{ width: 90, padding: "7px 10px", fontSize: 16, letterSpacing: ".25em", textAlign: "center", fontFamily: "'Cinzel', serif", border: "1px solid #c8b898", borderRadius: 4, background: "#f5f0e8", color: "#2a2015" }}
                                        />
                                        <button className="btn btn-grey" disabled={!isValidCode(joinCode)} onClick={joinOnlineGame} style={{ width: "auto", padding: "7px 18px", marginBottom: 0 }}>
                                            Rejoindre
                                        </button>
                                    </div>
                                </>}
                                {(online.status === "waiting" || online.status === "connected") && (
                                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 26, fontWeight: 700, letterSpacing: ".3em", color: "#8a6a08" }}>{online.code}</div>
                                )}
                                {online.status === "waiting" && (
                                    <div style={{ fontSize: 14, color: "#8a7a60", fontStyle: "italic" }}>Partagez ce code — en attente d'un adversaire…</div>
                                )}
                                {online.status === "connecting" && (
                                    <div style={{ fontSize: 14, color: "#8a7a60", fontStyle: "italic" }}>Connexion à la partie {online.code}…</div>
                                )}
                                {online.status === "connected" && (
                                    <div style={{ fontSize: 14, color: "#2e7d32" }}>✓ Adversaire connecté</div>
                                )}
                                {(online.status === "error" || online.status === "left") && <>
                                    <div style={{ fontSize: 14, color: "#a03030" }}>
                                        {online.status === "error" ? (online.role === "guest" ? "Connexion impossible — vérifiez le code." : "Erreur de connexion.") : "L'adversaire s'est déconnecté."}
                                    </div>
                                    <button className="btn btn-grey" onClick={backToOnlineMenu} style={{ width: "auto", padding: "7px 18px", marginBottom: 0 }}>
                                        Réessayer
                                    </button>
                                </>}
                            </div>
                        )}
                    </div>

                    {stepFooter(
                        <button className="btn btn-gold" disabled={!canAdvanceFromMode(online)} onClick={goNext} style={{ fontSize: 17, padding: "12px 36px" }}>
                            Suivant →
                        </button>
                    )}
                </>}

                {setupStep === "terrain" && <>
                    <div style={{ display: "flex", alignItems: "stretch", gap: 24 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 460 }}>
                            <div className="panel">
                                <div className="section-title">Villes</div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button className={`btn ${fairTowns ? "btn-gold" : "btn-grey"}`} onClick={() => setFairTowns(true)} style={{ flex: 1, marginBottom: 0 }}>
                                        Équitables
                                    </button>
                                    <button className={`btn ${!fairTowns ? "btn-gold" : "btn-grey"}`} onClick={() => setFairTowns(false)} style={{ flex: 1, marginBottom: 0 }}>
                                        Aléatoires
                                    </button>
                                </div>
                            </div>

                            <div className="panel">
                                <div className="section-title">Type de carte</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                                    {TERRAIN_PRESETS.map(p => {
                                        const active = Object.keys(p.density).every(k => terrainDensity[k] === p.density[k]);
                                        return (
                                            <button key={p.id} className={`preset-card${active ? " preset-active" : ""}`} onClick={() => setTerrainDensity(p.density)}>
                                                <span className="preset-icon">{p.icon}</span>
                                                <span className="preset-label">{p.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="panel">
                                <div className="section-title">Densité du terrain</div>
                                <div className="density-grid">
                                    {[
                                        { key: "obstacles", label: "🪨 Obstacles" },
                                        { key: "rivers", label: "💧 Rivières" },
                                        { key: "towns", label: "🏰 Villes" },
                                        { key: "forests", label: "🌲 Forêts" },
                                        { key: "hills", label: "⛰ Collines" },
                                        { key: "swamps", label: "🟤 Marais" },
                                    ].map(({ key, label }) => (
                                        <div key={key} className="density-row">
                                            <span className="density-label">{label}</span>
                                            <input type="range" min={0} max={3} step={1} className="density-slider" value={terrainDensity[key]} onChange={e => setDensity(key, Number(e.target.value))} />
                                            <span className="density-value">{TERRAIN_DENSITY_LABELS[terrainDensity[key]]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="panel" style={{ display: "flex", flexDirection: "column" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <div className="section-title" style={{ marginBottom: 0 }}>Aperçu de la carte</div>
                                <button className="btn btn-grey" onClick={regeneratePreview} style={{ width: "auto", padding: "4px 10px", fontSize: 12, marginBottom: 0 }}>
                                    🔄 Régénérer
                                </button>
                            </div>
                            <div style={{ border: "1px solid #d5cbb8", borderRadius: 6, overflow: "hidden", flex: 1 }}>
                                <canvas ref={previewCanvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: "block", width: 460, height: 405 }} />
                            </div>
                        </div>
                    </div>

                    {stepFooter(
                        <button className="btn btn-gold" onClick={goNext} style={{ fontSize: 17, padding: "12px 36px" }}>
                            Suivant →
                        </button>
                    )}
                </>}

                {setupStep === "armies" && <>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
                        {renderArmyPanel(1)}
                        {renderArmyPanel(2)}
                    </div>

                    {stepFooter(
                        online?.role === "guest" ? (
                            <button className="btn btn-grey" disabled style={{ fontSize: 17, padding: "12px 36px" }}>
                                En attente du lancement par l'hôte…
                            </button>
                        ) : (
                            <button className="btn btn-gold" disabled={!canStart || (online && online.status !== "connected")} onClick={startGame} style={{ fontSize: 17, padding: "12px 36px" }}>
                                ⚔ Lancer la partie
                            </button>
                        )
                    )}
                </>}
            </div>
        );
    }

    const sel = state.selectedUnit ? state.units.find(u => u.id === state.selectedUnit.id) : null;
    const hoveredUnit = hoveredHex ? unitAt(state.units, hoveredHex) : null;
    const phaseLabel = {
        select: "SÉLECTION", move: "MOUVEMENT", attack: "ATTAQUE", weapon_select: "CHOIX D'ARME", resolving: "RÉSOLUTION", consolidate: "CONSOLIDATION",
    }[state.phase] || "";
    const turns = turnSchedule();
    const curTurnIdx = state.winner ? -1 : currentTurnIndex(state.round, state.currentPlayer);
    // Regroupe les demi-tours par round (un round = 2 bulles) pour la frise.
    const friseRounds = [];
    for (let i = 0; i < turns.length; i += 2) friseRounds.push({ round: turns[i].round, halves: [turns[i], turns[i + 1]] });
    // Score cumulé connu à l'issue de chaque round clôturé.
    const scoreByRound = {};
    state.scoreHistory.forEach(h => { scoreByRound[h.round] = h.scores; });

    return (
        <div style={{ display: "flex", height: "100vh", background: "#f5f0e8", color: "#2a2015", fontFamily: "'Crimson Text', Georgia, serif", overflow: "hidden" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 20 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 24, fontWeight: 700, letterSpacing: ".2em", color: "#8a6a08", textShadow: "0 0 30px rgba(138,106,8,.2)" }}>
                    ⚔ WARHEX ⚔
                </div>

                {online?.status === "left" && !state.winner && (
                    <div style={{ background: "#a03030", color: "#f5f0e8", padding: "6px 16px", borderRadius: 4, fontSize: 14 }}>
                        L'adversaire s'est déconnecté — la partie ne peut pas continuer.
                    </div>
                )}

                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    style={{ border: "1px solid #c8b898", maxWidth: "100%" }}
                    onClick={onCanvasClick}
                    onMouseMove={onMouseMove}
                    onMouseLeave={() => { setHoveredHex(null); setTooltipPos(null); }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: CANVAS_W, width: "100%", marginTop: 6 }}>
                    <div style={{
                        background: "#ece5d8", border: `1px solid ${P[state.currentPlayer]}`,
                        padding: "6px 14px", fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: ".1em",
                        color: P[state.currentPlayer], borderRadius: 3,
                    }}>
                        {state.winner ? (state.winner === "draw" ? "⚖ ÉGALITÉ" : `🏆 JOUEUR ${state.winner} VICTORIEUX`) : `J${state.currentPlayer}${online ? (notMyTurn ? " (ADVERSAIRE)" : " (VOUS)") : ""} — ${phaseLabel} · ⚡${ACTIVATIONS_PER_TURN - state.activationsUsed}`}
                    </div>
                    <div style={{ background: "#ece5d8", border: "1px solid #c8b898", padding: "6px 12px", fontFamily: "'Cinzel', serif", fontSize: 12, color: "#8a7a60", display: "flex", gap: 12, alignItems: "center", borderRadius: 3 }}>
                        <span style={{ color: "#2a6fa8" }}>{state.scores[1]} pts</span>
                        <span>TOUR {state.round}/{ROUNDS_PER_GAME}</span>
                        <span style={{ color: "#a03030" }}>{state.scores[2]} pts</span>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", maxWidth: CANVAS_W, width: "100%", marginTop: 12, flexWrap: "wrap", rowGap: 10, gap: ROUND_GAP }}>
                    {friseRounds.map(({ round, halves }) => {
                        const scores = scoreByRound[round];
                        const showFx = scoreFx && scoreFx.round === round;
                        return (
                            <Fragment key={round}>
                                {round > 1 && <div style={{ width: 1, alignSelf: "center", height: BUBBLE_SIZE + 4, background: "#d5cbb8" }} />}
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: ".1em", color: "#8a7a60" }}>R{round}</div>
                                    <div style={{ display: "flex", gap: BUBBLE_GAP, position: "relative" }}>
                                        {halves.map((turn, h) => {
                                            const idx = (round - 1) * 2 + h;
                                            const color = P[turn.player];
                                            const isPast = state.winner ? true : idx < curTurnIdx;
                                            const isCurrent = idx === curTurnIdx;
                                            const justScored = showFx && scoreFx.gain[turn.player] > 0;
                                            return (
                                                <div key={h} className={justScored ? "frise-bubble scored" : "frise-bubble"} title={`Tour ${round} — J${turn.player}`} style={{
                                                    width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: "50%",
                                                    background: color,
                                                    opacity: isPast ? 0.3 : 1,
                                                    boxShadow: isCurrent ? `0 0 0 3px #f5f0e8, 0 0 0 5px ${color}` : "none",
                                                    transform: isCurrent ? "scale(1.15)" : "none",
                                                    transition: "opacity .2s, box-shadow .2s, transform .2s",
                                                    "--fx-color": color,
                                                }} />
                                            );
                                        })}
                                        {showFx && (
                                            <div className="frise-float">
                                                {scoreFx.gain[1] > 0 && <span style={{ color: P[1] }}>+{scoreFx.gain[1]}</span>}
                                                {scoreFx.gain[2] > 0 && <span style={{ color: P[2] }}>+{scoreFx.gain[2]}</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 600, minHeight: 14 }}>
                                        {scores
                                            ? <><span style={{ color: P[1] }}>{scores[1]}</span><span style={{ color: "#8a7a60" }}> – </span><span style={{ color: P[2] }}>{scores[2]}</span></>
                                            : <span style={{ color: "#c8b898" }}>–</span>}
                                    </div>
                                </div>
                            </Fragment>
                        );
                    })}
                </div>
            </div>

            <div style={{ width: 320, borderLeft: "1px solid #d5cbb8", background: "#ece5d8", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                {state.winner ? (
                    <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 16, letterSpacing: ".1em", color: "#2a2015", textAlign: "center" }}>
                            {state.winner === "draw" ? "ÉGALITÉ" : `JOUEUR ${state.winner} VICTORIEUX`}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-around", padding: "12px 0", borderTop: "1px solid #d5cbb8", borderBottom: "1px solid #d5cbb8" }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 4 }}>JOUEUR 1</div>
                                <div style={{ fontSize: 24, fontWeight: 700, color: "#2a6fa8" }}>{state.kills[1]}</div>
                                <div style={{ fontSize: 11, color: "#8a7a60" }}>kills</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#2a6fa8", marginTop: 4 }}>{state.scores[1]} pts</div>
                            </div>
                            <div style={{ width: 1, background: "#d5cbb8" }} />
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 4 }}>JOUEUR 2</div>
                                <div style={{ fontSize: 24, fontWeight: 700, color: "#a03030" }}>{state.kills[2]}</div>
                                <div style={{ fontSize: 11, color: "#8a7a60" }}>kills</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#a03030", marginTop: 4 }}>{state.scores[2]} pts</div>
                            </div>
                        </div>

                        {state.scoreHistory.length > 0 && <ScoreChart scoreHistory={state.scoreHistory} />}

                        <button className="btn btn-grey" onClick={restart}>↺ Nouvelle partie</button>
                    </div>
                ) : <>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #d5cbb8" }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 12 }}>INFOS DE PARTIE</div>
                    {(() => {
                        const control = computeTownControl(state.townOwnership || {});
                        return (
                            <div style={{ display: "flex", justifyContent: "space-around" }}>
                                {[1, 2].map(p => (
                                    <div key={p} style={{ textAlign: "center" }}>
                                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: ".15em", color: P[p], marginBottom: 8 }}>JOUEUR {p}</div>
                                        <div style={{ fontSize: 22, fontWeight: 700, color: P[p] }}>🏰 {control[p]}</div>
                                        <div style={{ fontSize: 11, color: "#8a7a60", marginBottom: 8 }}>villes</div>
                                        <div style={{ fontSize: 22, fontWeight: 700, color: P[p] }}>⚔ {state.kills[p]}</div>
                                        <div style={{ fontSize: 11, color: "#8a7a60" }}>kills</div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                <div style={{ padding: "16px 20px", borderBottom: "1px solid #d5cbb8" }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: ".15em", color: "#8a7a60", marginBottom: 12 }}>ACTIONS</div>

                    {state.phase === "consolidate" && state.pendingConsolidation ? (
                        <>
                            <div style={{ fontSize: 14, color: "#3a3020", marginBottom: 10 }}>Unité ennemie éliminée — prendre sa place ?</div>
                            <button className="btn btn-gold" disabled={(vsAI && state.currentPlayer === 2) || notMyTurn} onClick={() => applyAction(s => computeConsolidate(s, true))}>⟶ Prendre la place</button>
                            <button className="btn btn-grey" disabled={(vsAI && state.currentPlayer === 2) || notMyTurn} onClick={() => applyAction(s => computeConsolidate(s, false))}>✕ Rester</button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-blue" disabled={!sel || sel.hasMoved || state.phase === "attack" || (vsAI && state.currentPlayer === 2) || notMyTurn || !!state.movingUnit} onClick={startMove}>⟶ Déplacer</button>
                            <button className="btn btn-red" disabled={!sel || sel.hasAttacked || (vsAI && state.currentPlayer === 2) || notMyTurn || !!state.movingUnit} onClick={startAttack}>⚔ Attaquer</button>
                            {sel && <button className="btn btn-grey" disabled={notMyTurn || !!state.movingUnit} onClick={() => applyAction(computeDeselect)}>✕ Désélectionner</button>}
                        </>
                    )}
                    <div style={{ borderTop: "1px solid #d5cbb8", marginTop: 6, paddingTop: 8 }}>
                        <button className="btn btn-gold" disabled={!!state.winner || (vsAI && state.currentPlayer === 2) || notMyTurn || !!state.movingUnit} onClick={endTurn}>⏭ Fin de tour</button>
                    </div>
                </div>

            </>}
            </div>

            {hoveredUnit && tooltipPos && tooltipUnitId === hoveredUnit.id && (() => {
                const ratio = hoveredUnit.currentWounds / hoveredUnit.wounds;
                const level = ratio > 0.6 ? "hp-high" : ratio > 0.3 ? "hp-mid" : "hp-low";
                const saveMod = getSaveModifier(hoveredUnit, state);
                const effSave = hoveredUnit.save + saveMod;
                // svg plus basse = meilleure : un modificateur négatif améliore (vert).
                const saveColor = saveMod < 0 ? "#2e7d32" : saveMod > 0 ? "#c62828" : null;
                return (
                    <div className="unit-tooltip" style={{ left: tooltipPos.x + 16, top: tooltipPos.y + 16 }}>
                        <div className="unit-tooltip-head">
                            <div className="combat-medallion" style={{ borderColor: P[hoveredUnit.player] }}>{hoveredUnit.symbol}</div>
                            <div style={{ flex: 1 }}>
                                <div className="unit-tooltip-name" style={{ color: P[hoveredUnit.player] }}>{hoveredUnit.name}</div>
                                <div className="combat-hp">
                                    <div className="combat-hp-bar">
                                        {Array.from({ length: hoveredUnit.wounds }, (_, i) => (
                                            <span key={i} className={`combat-hp-seg ${i < hoveredUnit.currentWounds ? level : "empty"}`} />
                                        ))}
                                    </div>
                                    <span className="combat-hp-text">{hoveredUnit.currentWounds} / {hoveredUnit.wounds}</span>
                                </div>
                            </div>
                        </div>
                        <div className="unit-tooltip-stats">
                            <span className="combat-weapon-chip">MVT {hoveredUnit.movement}</span>
                            <span className="combat-weapon-chip" style={saveColor ? { color: saveColor, borderColor: saveColor } : {}}>
                                SVG {effSave}+{saveMod !== 0 ? ` (${saveMod > 0 ? "+" : ""}${saveMod})` : ""}
                            </span>
                        </div>
                        <div className="unit-tooltip-weapons">
                            {hoveredUnit.weapons.map(w => {
                                const rangeMod = getRangeModifier(hoveredUnit, w, state);
                                const effRange = w.range + rangeMod;
                                const rangeColor = rangeMod > 0 ? "#2e7d32" : null;
                                return (
                                    <div key={w.id} className="unit-tooltip-weapon">
                                        <span className="unit-tooltip-weapon-name">{w.type === "ranged" ? "🏹" : "⚔"} {w.name}</span>
                                        <span className="combat-weapon-chips" style={{ justifyContent: "flex-end" }}>
                                            <span className="combat-weapon-chip" style={rangeColor ? { color: rangeColor, borderColor: rangeColor } : {}}>
                                                Portée {w.minRange ? `${w.minRange}-` : ""}{effRange}{rangeMod > 0 ? ` (+${rangeMod})` : ""}
                                            </span>
                                            <span className="combat-weapon-chip">D{w.damage}</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {state && !state.winner && state.phase === "consolidate" && state.pendingConsolidation
                && !((vsAI && state.currentPlayer === 2) || notMyTurn) && (() => {
                const pos = hexScreenPos(state.pendingConsolidation.hex);
                if (!pos) return null;
                return (
                    <div className="consolidate-tooltip" style={{ left: pos.x, top: pos.y - HEX_SIZE * pos.scale - 8 }}>
                        <div className="consolidate-tooltip-label">Prendre la place ?</div>
                        <div className="consolidate-tooltip-actions">
                            <button className="consolidate-btn consolidate-btn-yes" onClick={() => applyAction(s => computeConsolidate(s, true))}>✓ Oui</button>
                            <button className="consolidate-btn consolidate-btn-no" onClick={() => applyAction(s => computeConsolidate(s, false))}>✕ Non</button>
                        </div>
                    </div>
                );
            })()}

            {state && !state.winner && (state.phase === "weapon_select" && state.pendingAttack || diceAnim) && (() => {
                const showWeapons = state.phase === "weapon_select" && state.pendingAttack && (!diceAnim || diceAnim.done);
                const showDice = diceAnim && !diceAnim.done;
                const showResult = diceAnim?.done;

                const src = diceAnim;
                const combatAttacker = showWeapons ? state.pendingAttack.attacker : src?.attacker;
                const combatTarget = showWeapons ? state.pendingAttack.target : src?.target;
                const modifiers = combatAttacker && combatTarget ? getCombatModifiers(combatAttacker, combatTarget, state) : { attacker: [], target: [] };
                const povPlayer = myPlayer || (vsAI ? 1 : null);
                const combatWeapon = src ? src.attacker?.weapons?.find(w => w.name === src.weaponName) : null;

                const animating = showDice;
                const visibleLog = src ? (animating ? src.log.slice(0, src.phase + 1) : src.log) : [];
                const hitEntry = visibleLog.find(e => !e.isSave && !e.isSummary);
                const saveEntry = src ? src.log.find(e => e.isSave) : null;
                const hitPhaseIdx = src ? src.log.findIndex(e => !e.isSave && !e.isSummary) : -1;
                const savePhaseIdx = src ? src.log.findIndex(e => e.isSave) : -1;

                function countVisibleSaves() {
                    if (!saveEntry) return 0;
                    const isSavePhase = animating && savePhaseIdx === src.phase;
                    const isSavePast = !animating || savePhaseIdx < src.phase;
                    if (!isSavePhase && !isSavePast) return 0;
                    const needed = parseInt((saveEntry.label.match(/(\d+)\+/) || [0, 7])[1]);
                    const dice = isSavePhase ? (saveEntry.rolls || []).slice(0, src.dice) : (saveEntry.rolls || []);
                    return dice.filter(r => r >= needed).length;
                }

                function renderHpBar(unit, losing = 0) {
                    if (!unit) return null;
                    const remaining = unit.currentWounds - losing;
                    const ratio = remaining / unit.wounds;
                    const level = ratio > 0.6 ? "hp-high" : ratio > 0.3 ? "hp-mid" : "hp-low";
                    return (
                        <div className="combat-hp">
                            <div className="combat-hp-bar">
                                {Array.from({ length: unit.wounds }, (_, i) => {
                                    const cls = i < remaining ? `combat-hp-seg ${level}` : i < unit.currentWounds ? "combat-hp-seg losing" : "combat-hp-seg empty";
                                    const delay = i >= remaining && i < unit.currentWounds ? { animationDelay: `${(unit.currentWounds - 1 - i) * 0.18}s` } : undefined;
                                    return <span key={i} className={cls} style={delay} />;
                                })}
                            </div>
                            <span className="combat-hp-text">{remaining} / {unit.wounds}</span>
                        </div>
                    );
                }

                function renderDiceBlock(entry, phaseIdx, struckCount = 0) {
                    if (!entry) return null;
                    const isCurrentPhase = animating && phaseIdx === src.phase;
                    const isFuturePhase = animating && phaseIdx > src.phase;
                    const visibleDice = isFuturePhase ? [] : isCurrentPhase ? (entry.rolls || []).slice(0, src.dice) : (entry.rolls || []);
                    const showSpinning = isCurrentPhase && src.rolling;

                    let struckRemaining = struckCount;

                    return (
                        <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 13, color: "#6a5a40", marginBottom: (visibleDice.length || showSpinning) ? 4 : 0 }}>{entry.label}</div>
                            {(visibleDice.length > 0 || showSpinning) && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 0, justifyContent: "center" }}>
                                    {visibleDice.map((r, j) => {
                                        const needed = entry.isSave
                                            ? parseInt((entry.label.match(/(\d+)\+/) || [0, 7])[1])
                                            : parseInt((entry.label.match(/(\d+)\+/) || [0, 0])[1]);
                                        const hit = r >= needed;
                                        const struck = hit && struckRemaining > 0;
                                        if (struck) struckRemaining--;
                                        const cls = entry.isSave ? (hit ? "roll-save" : "roll-save-fail") : struck ? "roll-struck" : (hit ? "roll-hit" : "roll-miss");
                                        const isNew = isCurrentPhase && j === src.dice - 1 && !src.rolling;
                                        return <span key={j} className={`roll-chip ${cls}${isNew ? " roll-new" : ""}`}>{r}</span>;
                                    })}
                                    {showSpinning && <span className="roll-chip roll-spinning">?</span>}
                                </div>
                            )}
                        </div>
                    );
                }

                return (
                    <div className="combat-overlay" onClick={showResult ? closeCombatModal : undefined}>
                        <div className={`combat-modal${showResult && src.damage > 0 ? " shake" : ""}`} onClick={e => e.stopPropagation()}>
                            <div className="combat-modal-header">
                                <h2>COMBAT</h2>
                                {(showDice || showResult) && src && (
                                    <div className="combat-weapon">
                                        <div className="combat-weapon-name">{src.weaponType === "melee" ? "⚔" : "🏹"} {src.weaponName}</div>
                                        {combatWeapon && (
                                            <div className="combat-weapon-chips">
                                                <span className="combat-weapon-chip">Portée {combatWeapon.range}</span>
                                                <span className="combat-weapon-chip">{combatWeapon.attacks} att.</span>
                                                {combatWeapon.ap !== 0 && <span className="combat-weapon-chip">PA {combatWeapon.ap}</span>}
                                                <span className="combat-weapon-chip">D{combatWeapon.damage}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {(showDice || showResult) && src && (
                                    <div className="combat-steps">
                                        {[
                                            { label: "Touche", idx: hitPhaseIdx },
                                            { label: "Sauvegarde", idx: savePhaseIdx },
                                            { label: "Résultat", idx: null },
                                        ].map((step, i) => {
                                            const cls = showResult
                                                ? (step.idx === null ? "active" : "done")
                                                : step.idx !== null && step.idx !== -1 && src.phase > step.idx ? "done"
                                                : step.idx === src.phase ? "active"
                                                : "todo";
                                            return (
                                                <span key={i} className={`combat-step ${cls}`}>
                                                    <span className="combat-step-dot" />{step.label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="combat-modal-body">
                                <div className="combat-columns">
                                    <div className={`combat-col player-${combatAttacker?.player}`}>
                                        <div className="combat-col-banner">
                                            <div className="combat-col-role">ATTAQUANT</div>
                                            {povPlayer && <div className="combat-col-side">{combatAttacker?.player === povPlayer ? "VOUS" : "ADVERSAIRE"}</div>}
                                        </div>
                                        <div className="combat-col-body">
                                            <div className="combat-medallion" style={{ borderColor: P[combatAttacker?.player] }}>{combatAttacker?.symbol}</div>
                                            <div className="combat-col-name" style={{ color: P[combatAttacker?.player] }}>{combatAttacker?.name}</div>
                                            {renderHpBar(combatAttacker)}
                                            {modifiers.attacker.map((m, i) => (
                                                <span key={i} className={`combat-modifier ${m.type}`}>{m.icon} {m.label}</span>
                                            ))}
                                            {showWeapons && (
                                                <div className="combat-col-weapons">
                                                    {state.pendingAttack.attacker.weapons.map(w => (
                                                        <WeaponCard key={w.id} weapon={w} attacker={state.pendingAttack.attacker} target={state.pendingAttack.target} hills={state.hills} towns={state.towns} aiPreview={state.aiPreview} onSelect={selectWeapon} />
                                                    ))}
                                                </div>
                                            )}
                                            {(showDice || showResult) && renderDiceBlock(hitEntry, hitPhaseIdx, countVisibleSaves())}
                                        </div>
                                    </div>
                                    <div className={`combat-vs${showDice ? " vs-clash" : ""}`}>VS</div>
                                    <div className={`combat-col player-${combatTarget?.player}${showResult ? (src.damage > 0 ? " flash-damage" : " flash-saved") : ""}`}>
                                        <div className="combat-col-banner">
                                            <div className="combat-col-role">DÉFENSEUR</div>
                                            {povPlayer && <div className="combat-col-side">{combatTarget?.player === povPlayer ? "VOUS" : "ADVERSAIRE"}</div>}
                                        </div>
                                        <div className="combat-col-body">
                                            <div className={`combat-medallion${showResult && src.isDead ? " dead" : ""}`} style={{ borderColor: P[combatTarget?.player] }}>
                                                {combatTarget?.symbol}
                                                {showResult && src.isDead && <span className="combat-medallion-skull">💀</span>}
                                            </div>
                                            <div className="combat-col-name" style={{ color: P[combatTarget?.player] }}>{combatTarget?.name}</div>
                                            {renderHpBar(combatTarget, showResult ? Math.min(src.damage, combatTarget?.currentWounds ?? 0) : 0)}
                                            <div className="combat-meta">🛡 Svg {combatTarget?.save}+</div>
                                            {modifiers.target.map((m, i) => (
                                                <span key={i} className={`combat-modifier ${m.type}`}>{m.icon} {m.label}</span>
                                            ))}
                                            {(showDice || showResult) && renderDiceBlock(saveEntry, savePhaseIdx)}
                                        </div>
                                    </div>
                                </div>
                                {showResult && (
                                    <div className={`combat-result-banner ${src.isDead ? "dead" : src.damage > 0 ? "damage" : "saved"}`}>
                                        {src.isDead ? `💀 ${src.target.name} éliminé !` : src.damage > 0 ? `💥 ${src.damage} dégât(s) infligé(s)` : "🛡 Attaque parée !"}
                                    </div>
                                )}
                            </div>

                            <div className="combat-modal-footer">
                                {showWeapons && !notMyTurn && (
                                    <button className="btn btn-grey" style={{ width: "auto", padding: "8px 24px" }} onClick={() => applyAction(computeCancelAttack)}>✕ Annuler</button>
                                )}
                                {showResult && (
                                    <button className="btn btn-gold" style={{ width: "auto", padding: "8px 24px" }} onClick={closeCombatModal}>Fermer</button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
