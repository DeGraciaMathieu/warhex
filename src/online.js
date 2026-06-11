import { Peer } from "peerjs";

const PEER_PREFIX = "warhex-";
export const CODE_LENGTH = 4;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode() {
    return Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
}

export function normalizeCode(input) {
    return (input || "").trim().toUpperCase();
}

export function isValidCode(code) {
    return code.length === CODE_LENGTH && [...code].every(c => CODE_CHARS.includes(c));
}

// Les timestamps d'animation (deathTime, time) viennent de l'horloge de l'autre
// machine : on les ramène à l'horloge locale pour que les animations se jouent.
export function remapAnimationTimes(state, now = Date.now()) {
    return {
        ...state,
        dyingUnits: (state.dyingUnits || []).map(d => ({ ...d, deathTime: now })),
        hitEffects: (state.hitEffects || []).map(e => ({ ...e, time: now })),
    };
}

export function onlinePlayerNumber(online) {
    if (online?.role === "host") return 1;
    if (online?.role === "guest") return 2;
    return null;
}

export function isNotMyTurn(state, online, myPlayer) {
    return !!online && !!state && state.currentPlayer !== myPlayer;
}

// Les dégâts sont calculés et appliqués uniquement côté attaquant ; le défenseur
// reçoit l'état final via le réseau, sinon ils seraient appliqués deux fois.
export function shouldApplyDamage(anim, online, myPlayer) {
    return !online || anim.attacker.player === myPlayer;
}

export function applyOnlineMessage(msg, now = Date.now()) {
    switch (msg.type) {
        case "army":
            return { armySelection: { player: msg.player, selections: msg.selections } };
        case "start":
            return { state: remapAnimationTimes(msg.state, now), startGame: true };
        case "state":
            return { state: remapAnimationTimes(msg.state, now) };
        case "combat":
            return { state: remapAnimationTimes(msg.state, now), diceAnim: msg.anim };
        default:
            return null;
    }
}

function wireConnection(conn, handlers) {
    conn.on("open", () => handlers.onConnect(conn));
    conn.on("data", msg => handlers.onMessage(msg));
    conn.on("close", () => handlers.onDisconnect());
    conn.on("error", err => handlers.onError(err));
}

export function hostGame(code, handlers) {
    const peer = new Peer(PEER_PREFIX + code);
    let accepted = false;
    peer.on("connection", conn => {
        if (accepted) {
            conn.close();
            return;
        }
        accepted = true;
        wireConnection(conn, handlers);
    });
    peer.on("error", err => handlers.onError(err));
    return peer;
}

export function joinGame(code, handlers) {
    const peer = new Peer();
    peer.on("open", () => {
        const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
        wireConnection(conn, handlers);
    });
    peer.on("error", err => handlers.onError(err));
    return peer;
}
