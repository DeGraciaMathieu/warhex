export const HEX_SIZE = 36;

export function hexToPixel(q, r) {
    return {
        x: HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
        y: HEX_SIZE * (1.5 * r),
    };
}

export function pixelToHex(x, y) {
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

export function hexDistance(a, b) {
    return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

export function hexKey(h) { return `${h.q},${h.r},${h.s}`; }

const DIRECTIONS = [
    { q: 1, r: -1, s: 0 }, { q: 1, r: 0, s: -1 }, { q: 0, r: 1, s: -1 },
    { q: -1, r: 1, s: 0 }, { q: -1, r: 0, s: 1 }, { q: 0, r: -1, s: 1 },
];

export function hexNeighbors(h) {
    return DIRECTIONS.map(d => ({ q: h.q + d.q, r: h.r + d.r, s: h.s + d.s }));
}

export function isValidHex(h) {
    return Math.abs(h.q) <= 5 && Math.abs(h.r) <= 5 && Math.abs(h.s) <= 5;
}

export function hexCorners(cx, cy, size) {
    return Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i - 30);
        return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) };
    });
}

export function reachableHexes(start, movement, occupiedKeys, obstacleKeys = new Set(), stopKeys = new Set()) {
    const startKey = hexKey(start);
    const visited = new Map([[startKey, 0]]);
    const queue = [start];
    const result = [];
    while (queue.length) {
        const cur = queue.shift();
        const curKey = hexKey(cur);
        const dist = visited.get(curKey);
        if (dist > 0) result.push(cur);
        const isStopped = curKey !== startKey && stopKeys.has(curKey);
        if (dist < movement && !isStopped) {
            for (const n of hexNeighbors(cur)) {
                const k = hexKey(n);
                if (!visited.has(k) && !occupiedKeys.has(k) && !obstacleKeys.has(k) && isValidHex(n)) {
                    visited.set(k, dist + 1);
                    queue.push(n);
                }
            }
        }
    }
    return result;
}

function cubeLineDraw(a, b) {
    const n = hexDistance(a, b);
    if (n === 0) return [a];
    const results = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const q = a.q + (b.q - a.q) * t;
        const r = a.r + (b.r - a.r) * t;
        const s = a.s + (b.s - a.s) * t;
        results.push(cubeRound(q, r, s));
    }
    return results;
}

export function hasLineOfSight(a, b, obstacleKeys) {
    const line = cubeLineDraw(a, b);
    for (let i = 1; i < line.length - 1; i++) {
        if (obstacleKeys.has(hexKey(line[i]))) return false;
    }
    return true;
}
