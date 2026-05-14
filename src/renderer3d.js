import * as THREE from "three";
import { hexToPixel, hexKey, isValidHex, HEX_SIZE } from "./hex.js";

const SCALE = 0.02;
const HEX_3D = HEX_SIZE * SCALE;
const GAP = 0.92;
const TILE_H = 0.12;

const COL = {
    bg: 0x2a2520,
    ground: 0x3a3530,
    defaultTile: 0xc8bca0,
    obstacle: 0x6a5a40,
    river: 0x5a9ac8,
    town: 0xe0d0a0,
    townP1: 0x5a9ad0,
    townP2: 0xc06060,
    forest: 0x6aaa50,
    hill: 0xb8a870,
    swamp: 0x607848,
    move: 0x4a9ae0,
    moveHover: 0x70b8ff,
    target: 0xe04040,
    targetHover: 0xff6060,
    attackRange: 0xd08030,
    edge: 0x8a7a60,
    p1: { fill: 0x4a90d0, ring: 0x2a6fa8, emissive: 0x1a4f78 },
    p2: { fill: 0xd05050, ring: 0xa03030, emissive: 0x802020 },
    dimmed: 0x888888,
};

const HEIGHTS = {
    default: TILE_H,
    obstacle: TILE_H * 5,
    river: TILE_H * 0.4,
    town: TILE_H * 1.8,
    forest: TILE_H * 1.2,
    hill: TILE_H * 3.5,
    swamp: TILE_H * 0.5,
};

// Reusable Color objects to avoid GC pressure
const _tmpColorA = new THREE.Color();
const _tmpColorB = new THREE.Color();

function hexToWorld(q, r) {
    const { x, y } = hexToPixel(q, r);
    return { x: x * SCALE, z: y * SCALE };
}

function makeHexShape(size) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        const x = size * Math.cos(a), y = size * Math.sin(a);
        i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
}

function makeHexEdgeLoop(size, y) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
        const a = (Math.PI / 180) * (60 * (i % 6) - 30);
        pts.push(new THREE.Vector3(size * Math.cos(a), y, size * Math.sin(a)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
}

function makeTextCanvas(text, size = 128, fontSize = 72, color = "#fff") {
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const g = c.getContext("2d");
    g.font = `${fontSize}px serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color;
    g.fillText(text, size / 2, size / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
}

// Sprite texture cache to avoid recreating identical textures
const _spriteTexCache = new Map();
function getCachedTexture(text, fontSize, color) {
    const key = `${text}_${fontSize}_${color}`;
    if (!_spriteTexCache.has(key)) {
        _spriteTexCache.set(key, makeTextCanvas(text, 128, fontSize, color));
    }
    return _spriteTexCache.get(key);
}

function makeSprite(text, fontSize = 72, color = "#fff", scale = 1) {
    const tex = getCachedTexture(text, fontSize, color);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(HEX_3D * 1.3 * scale, HEX_3D * 1.3 * scale, 1);
    return s;
}

// Shared materials for decorations (avoid duplicates)
const _sharedMats = {};
function getSharedMat(key, props) {
    if (!_sharedMats[key]) _sharedMats[key] = new THREE.MeshStandardMaterial(props);
    return _sharedMats[key];
}

function makeTree(height = 0.25) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.02, height * 0.35, 6),
        getSharedMat("trunk", { color: 0x6a4a28, roughness: 0.9 })
    );
    trunk.position.y = height * 0.175;
    trunk.castShadow = true;
    g.add(trunk);

    const foliage = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, height * 0.7, 6),
        getSharedMat("foliage", { color: 0x3a7a28, roughness: 0.7 })
    );
    foliage.position.y = height * 0.35 + height * 0.35;
    foliage.castShadow = true;
    g.add(foliage);
    return g;
}

function makeRock() {
    const g = new THREE.Group();
    const mat = getSharedMat("rock", { color: 0x7a6a50, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 3; i++) {
        const s = 0.04 + Math.random() * 0.04;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
        rock.position.set((Math.random() - 0.5) * 0.08, s * 0.6, (Math.random() - 0.5) * 0.08);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        g.add(rock);
    }
    return g;
}

function makeHouse() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.08, 0.08),
        getSharedMat("houseWall", { color: 0xd4c098, roughness: 0.8 })
    );
    base.position.y = 0.04;
    base.castShadow = true;
    g.add(base);

    const roofShape = new THREE.Shape();
    roofShape.moveTo(-0.06, 0);
    roofShape.lineTo(0, 0.05);
    roofShape.lineTo(0.06, 0);
    roofShape.closePath();
    const roof = new THREE.Mesh(
        new THREE.ExtrudeGeometry(roofShape, { depth: 0.09, bevelEnabled: false }),
        getSharedMat("houseRoof", { color: 0xa04030, roughness: 0.7 })
    );
    roof.position.set(0, 0.08, -0.045);
    roof.castShadow = true;
    g.add(roof);
    return g;
}

function makeHillDecor() {
    const g = new THREE.Group();
    const mat = getSharedMat("hillDisc", { color: 0xb0a070, roughness: 0.85 });
    for (let i = 0; i < 3; i++) {
        const r = 0.09 - i * 0.02;
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.01, 0.02, 8), mat);
        disc.position.y = i * 0.02 + 0.01;
        g.add(disc);
    }
    return g;
}

export function createScene(container) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COL.bg);
    scene.fog = new THREE.FogExp2(COL.bg, 0.06);

    const aspect = container.clientWidth / container.clientHeight;
    const frustum = 5;
    const camera = new THREE.OrthographicCamera(
        -frustum * aspect, frustum * aspect, frustum, -frustum, 0.1, 100
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // Warm key light with shadows
    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
    keyLight.position.set(4, 10, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -8;
    keyLight.shadow.bias = -0.002;
    keyLight.shadow.radius = 3;
    scene.add(keyLight);

    // Cool fill light
    const fillLight = new THREE.DirectionalLight(0xc0d8ff, 0.4);
    fillLight.position.set(-3, 6, -4);
    scene.add(fillLight);

    const ambient = new THREE.AmbientLight(0xfff8f0, 0.35);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xc8d8ff, 0x4a3a20, 0.3);
    scene.add(hemi);

    // Ground plane
    const groundGeo = new THREE.CircleGeometry(12, 64);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: COL.ground, roughness: 1 }));
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    const tileGroup = new THREE.Group();
    const unitGroup = new THREE.Group();
    const effectGroup = new THREE.Group();
    const decorGroup = new THREE.Group();
    scene.add(tileGroup);
    scene.add(decorGroup);
    scene.add(unitGroup);
    scene.add(effectGroup);

    const hexShape = makeHexShape(HEX_3D * GAP);

    const ctx = {
        scene, camera, renderer, container,
        tileGroup, unitGroup, effectGroup, decorGroup,
        raycaster: new THREE.Raycaster(),
        hexShape,
        tileMeshes: new Map(),
        tileEdges: new Map(),
        unitMeshes: new Map(),
        decorObjects: new Map(),
        selectionRings: new Map(),
        animationId: null,
        shadowBaked: false,
        isDragging: false,
        lastMouse: { x: 0, y: 0 },
        cameraAngle: Math.PI / 4,
        cameraPitch: Math.PI / 4.5,
        cameraDistance: 10,
        cameraTarget: new THREE.Vector3(0, 0, 0),
        time: 0,
        // Dirty tracking: only re-render when something changed
        dirty: true,
        needsAnimation: false,
        // Cached terrain sets: rebuilt only when state reference changes
        cachedState: null,
        cachedTerrainSets: null,
        cachedTerrainTypes: null,
    };

    updateCameraPosition(ctx);
    return ctx;
}

function updateCameraPosition(ctx) {
    const { camera, cameraAngle, cameraPitch, cameraDistance, cameraTarget } = ctx;
    camera.position.set(
        cameraTarget.x + cameraDistance * Math.cos(cameraPitch) * Math.cos(cameraAngle),
        cameraTarget.y + cameraDistance * Math.sin(cameraPitch),
        cameraTarget.z + cameraDistance * Math.cos(cameraPitch) * Math.sin(cameraAngle)
    );
    camera.lookAt(cameraTarget);
    ctx.dirty = true;
}

export function setupControls(ctx, onHover, onClick) {
    const canvas = ctx.renderer.domElement;

    function getPointer(e) {
        const r = canvas.getBoundingClientRect();
        return new THREE.Vector2(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            -((e.clientY - r.top) / r.height) * 2 + 1
        );
    }

    function raycastHex(e) {
        ctx.raycaster.setFromCamera(getPointer(e), ctx.camera);
        const hits = ctx.raycaster.intersectObjects(ctx.tileGroup.children, false);
        for (const hit of hits) {
            if (hit.object.userData.hex) return hit.object.userData.hex;
        }
        return null;
    }

    canvas.addEventListener("mousedown", (e) => {
        ctx.isDragging = false;
        ctx.lastMouse = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener("mousemove", (e) => {
        const dx = e.clientX - ctx.lastMouse.x;
        const dy = e.clientY - ctx.lastMouse.y;
        if (e.buttons === 1 && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
            ctx.isDragging = true;
            ctx.cameraAngle -= dx * 0.005;
            ctx.cameraPitch = Math.max(0.15, Math.min(Math.PI / 2.2, ctx.cameraPitch + dy * 0.005));
            updateCameraPosition(ctx);
            ctx.lastMouse = { x: e.clientX, y: e.clientY };
            return;
        }
        onHover(raycastHex(e));
    });

    canvas.addEventListener("mouseup", (e) => {
        if (!ctx.isDragging) {
            const hex = raycastHex(e);
            if (hex) onClick(hex);
        }
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const f = ctx.camera.top;
        const nf = Math.max(2, Math.min(10, f + e.deltaY * 0.004));
        const a = ctx.container.clientWidth / ctx.container.clientHeight;
        ctx.camera.left = -nf * a;
        ctx.camera.right = nf * a;
        ctx.camera.top = nf;
        ctx.camera.bottom = -nf;
        ctx.camera.updateProjectionMatrix();
        ctx.dirty = true;
    }, { passive: false });
}

export function handleResize(ctx) {
    const w = ctx.container.clientWidth, h = ctx.container.clientHeight;
    ctx.renderer.setSize(w, h);
    const a = w / h, f = ctx.camera.top;
    ctx.camera.left = -f * a;
    ctx.camera.right = f * a;
    ctx.camera.updateProjectionMatrix();
    ctx.dirty = true;
}

// Build and cache terrain sets — only when state object changes
function getTerrainSets(ctx, state) {
    if (ctx.cachedState === state) return ctx.cachedTerrainSets;
    ctx.cachedState = state;
    ctx.cachedTerrainSets = {
        obstacle: new Set((state.obstacles || []).map(hexKey)),
        river: new Set((state.rivers || []).map(hexKey)),
        town: new Set((state.towns || []).map(hexKey)),
        forest: new Set((state.forests || []).map(hexKey)),
        hill: new Set((state.hills || []).map(hexKey)),
        swamp: new Set((state.swamps || []).map(hexKey)),
    };
    // Pre-compute terrain type per hex
    const types = new Map();
    for (let q = -6; q <= 6; q++) {
        for (let r = -6; r <= 6; r++) {
            const s = -q - r;
            if (!isValidHex({ q, r, s })) continue;
            const k = hexKey({ q, r, s });
            const sets = ctx.cachedTerrainSets;
            if (sets.obstacle.has(k)) types.set(k, "obstacle");
            else if (sets.hill.has(k)) types.set(k, "hill");
            else if (sets.town.has(k)) types.set(k, "town");
            else if (sets.forest.has(k)) types.set(k, "forest");
            else if (sets.river.has(k)) types.set(k, "river");
            else if (sets.swamp.has(k)) types.set(k, "swamp");
            else types.set(k, "default");
        }
    }
    ctx.cachedTerrainTypes = types;
    return ctx.cachedTerrainSets;
}

function getTerrainType(k, ctx) {
    return ctx.cachedTerrainTypes?.get(k) || "default";
}

function getTileColor(type, k, townOwnership) {
    if (type === "town") {
        const o = townOwnership[k];
        return o === 1 ? COL.townP1 : o === 2 ? COL.townP2 : COL.town;
    }
    return COL[type] || COL.defaultTile;
}

function updateTiles(ctx, state, hoveredHex, time) {
    const moveKeys = new Set(state.validMoves.map(hexKey));
    const targetKeys = new Set((state.validTargets || []).map(u => hexKey(u.hex)));
    const rangeKeys = new Set((state.attackRangeHexes || []).map(hexKey));
    const townOwnership = state.townOwnership || {};
    const hovKey = hoveredHex ? hexKey(hoveredHex) : null;

    const hasAnimatedTiles = moveKeys.size > 0 || targetKeys.size > 0;
    let hasRivers = false;

    for (let q = -6; q <= 6; q++) {
        for (let r = -6; r <= 6; r++) {
            const s = -q - r;
            const hex = { q, r, s };
            if (!isValidHex(hex)) continue;

            const k = hexKey(hex);
            const { x, z } = hexToWorld(q, r);
            const terrain = getTerrainType(k, ctx);
            const h = HEIGHTS[terrain];

            if (terrain === "river") hasRivers = true;

            const isMove = moveKeys.has(k);
            const isTarget = targetKeys.has(k);
            const isRange = !isMove && !isTarget && rangeKeys.has(k);
            const isHov = k === hovKey;

            let color = getTileColor(terrain, k, townOwnership);
            let emissiveHex = 0x000000;
            let emissiveIntensity = 0;

            if (isMove) {
                color = isHov ? COL.moveHover : COL.move;
                emissiveHex = COL.move;
                emissiveIntensity = 0.15 + 0.1 * Math.sin(time * 3);
            } else if (isTarget) {
                color = isHov ? COL.targetHover : COL.target;
                emissiveHex = COL.target;
                emissiveIntensity = 0.2 + 0.15 * Math.sin(time * 4);
            } else if (isRange) {
                color = COL.attackRange;
                emissiveHex = COL.attackRange;
                emissiveIntensity = 0.08;
            }

            if (!ctx.tileMeshes.has(k)) {
                const geo = new THREE.ExtrudeGeometry(ctx.hexShape, {
                    depth: h, bevelEnabled: true,
                    bevelThickness: 0.015, bevelSize: 0.01, bevelSegments: 2,
                });
                geo.rotateX(-Math.PI / 2);
                geo.translate(0, -h / 2, 0);

                const mat = new THREE.MeshStandardMaterial({
                    color, roughness: terrain === "river" ? 0.2 : 0.75,
                    metalness: terrain === "river" ? 0.1 : 0.0,
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, h / 2, z);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData = { hex, hexKey: k };
                ctx.tileGroup.add(mesh);
                ctx.tileMeshes.set(k, mesh);

                const edgeGeo = makeHexEdgeLoop(HEX_3D * GAP, h / 2 + 0.002);
                const edgeMat = new THREE.LineBasicMaterial({ color: COL.edge, transparent: true, opacity: 0.3 });
                const edge = new THREE.Line(edgeGeo, edgeMat);
                edge.position.set(x, h / 2, z);
                ctx.tileGroup.add(edge);
                ctx.tileEdges.set(k, edge);

                // 3D decorations
                let decor = null;
                if (terrain === "forest") {
                    decor = new THREE.Group();
                    const positions = [[0, 0], [0.06, 0.04], [-0.05, 0.03], [0.03, -0.05]];
                    positions.forEach(([ox, oz]) => {
                        const tree = makeTree(0.18 + Math.random() * 0.1);
                        tree.position.set(ox, h, oz);
                        tree.rotation.y = Math.random() * Math.PI;
                        decor.add(tree);
                    });
                    decor.position.set(x, 0, z);
                } else if (terrain === "obstacle") {
                    decor = makeRock();
                    decor.position.set(x, h, z);
                } else if (terrain === "town") {
                    decor = makeHouse();
                    decor.position.set(x, h, z);
                    decor.rotation.y = Math.random() * Math.PI;
                    decor.scale.setScalar(0.7);
                } else if (terrain === "hill") {
                    decor = makeHillDecor();
                    decor.position.set(x, h, z);
                } else if (terrain === "swamp") {
                    decor = new THREE.Mesh(
                        new THREE.CylinderGeometry(HEX_3D * 0.5, HEX_3D * 0.5, 0.005, 12),
                        getSharedMat("swampDisc", { color: 0x506838, roughness: 0.3, transparent: true, opacity: 0.6 })
                    );
                    decor.position.set(x, h + 0.003, z);
                }
                if (decor) {
                    ctx.decorGroup.add(decor);
                    ctx.decorObjects.set(k, decor);
                }
            } else {
                const mesh = ctx.tileMeshes.get(k);
                mesh.material.color.setHex(color);
                mesh.material.emissive.setHex(emissiveHex);
                mesh.material.emissiveIntensity = emissiveIntensity;

                if (terrain === "river") {
                    _tmpColorA.setHex(0x4a8ab8);
                    _tmpColorB.setHex(0x6abae8);
                    _tmpColorA.lerp(_tmpColorB, 0.5 + 0.5 * Math.sin(time * 2 + x * 5));
                    mesh.material.color.copy(_tmpColorA);
                }

                const edge = ctx.tileEdges.get(k);
                if (edge) {
                    const ec = isTarget ? COL.target : isMove ? COL.move : isRange ? COL.attackRange : COL.edge;
                    edge.material.color.setHex(ec);
                    edge.material.opacity = (isTarget || isMove || isRange) ? 0.8 : 0.3;
                }
            }
        }
    }

    if (hasAnimatedTiles || hasRivers) ctx.needsAnimation = true;
}

function updateUnits(ctx, state, time) {
    const now = Date.now();
    const shakes = new Map();
    (state.hitEffects || []).forEach(e => {
        const el = now - e.time;
        if (el < 500) shakes.set(hexKey(e.hex), el);
    });

    if (shakes.size > 0) ctx.needsAnimation = true;

    const alive = new Set();

    state.units.forEach(unit => {
        if (unit.currentWounds <= 0) return;
        alive.add(unit.id);

        const { x, z } = hexToWorld(unit.hex.q, unit.hex.r);
        const k = hexKey(unit.hex);
        const terrain = getTerrainType(k, ctx);
        const th = HEIGHTS[terrain];

        const shakeEl = shakes.get(k);
        const sx = shakeEl !== undefined ? Math.sin(shakeEl / 18) * 0.1 * (1 - shakeEl / 500) : 0;

        const selected = state.selectedUnit?.id === unit.id;
        const dimmed = unit.hasMoved && unit.hasAttacked;
        const pc = unit.player === 1 ? COL.p1 : COL.p2;

        const ur = HEX_3D * 0.38;
        const uh = HEX_3D * 0.8;
        const baseY = th + uh / 2;

        const bob = selected ? Math.sin(time * 3) * 0.02 : 0;
        if (selected) ctx.needsAnimation = true;

        if (!ctx.unitMeshes.has(unit.id)) {
            const group = new THREE.Group();

            const baseGeo = new THREE.CylinderGeometry(ur + 0.02, ur + 0.04, 0.03, 16);
            const baseMat = new THREE.MeshStandardMaterial({ color: pc.ring, roughness: 0.5, metalness: 0.3 });
            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.015;
            baseMesh.castShadow = true;
            group.add(baseMesh);
            group.userData.base = baseMesh;

            const bodyGeo = new THREE.CylinderGeometry(ur * 0.85, ur, uh * 0.7, 16);
            const bodyMat = new THREE.MeshStandardMaterial({
                color: dimmed ? COL.dimmed : pc.fill, roughness: 0.4, metalness: 0.1,
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.03 + uh * 0.35;
            body.castShadow = true;
            group.add(body);
            group.userData.body = body;

            const headGeo = new THREE.SphereGeometry(ur * 0.7, 16, 12);
            const headMat = new THREE.MeshStandardMaterial({
                color: dimmed ? COL.dimmed : pc.fill, roughness: 0.35, metalness: 0.15,
            });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 0.03 + uh * 0.7 + ur * 0.3;
            head.castShadow = true;
            group.add(head);
            group.userData.head = head;

            const sprite = makeSprite(unit.symbol, 80, "#fff", 0.9);
            sprite.position.y = uh + 0.12;
            group.add(sprite);

            const hpW = HEX_3D * 0.9;
            const hpBgGeo = new THREE.PlaneGeometry(hpW, 0.035);
            const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x2a2015, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
            const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
            hpBg.rotation.x = -Math.PI / 2;
            hpBg.position.y = -0.005;
            group.add(hpBg);

            const hpGeo = new THREE.PlaneGeometry(hpW, 0.03);
            const hpMat = new THREE.MeshBasicMaterial({ color: 0x4caf50, side: THREE.DoubleSide });
            const hp = new THREE.Mesh(hpGeo, hpMat);
            hp.rotation.x = -Math.PI / 2;
            hp.position.y = -0.003;
            group.add(hp);
            group.userData.hp = hp;

            group.position.set(x + sx, baseY + bob, z);
            ctx.unitGroup.add(group);
            ctx.unitMeshes.set(unit.id, group);
        } else {
            const group = ctx.unitMeshes.get(unit.id);
            group.position.set(x + sx, baseY + bob, z);

            const body = group.userData.body;
            const head = group.userData.head;
            const baseMesh = group.userData.base;

            body.material.color.setHex(dimmed ? COL.dimmed : pc.fill);
            head.material.color.setHex(dimmed ? COL.dimmed : pc.fill);
            baseMesh.material.color.setHex(dimmed ? 0x666666 : pc.ring);

            if (selected) {
                body.material.emissive.setHex(pc.emissive);
                body.material.emissiveIntensity = 0.4 + 0.2 * Math.sin(time * 4);
                head.material.emissive.setHex(pc.emissive);
                head.material.emissiveIntensity = 0.4 + 0.2 * Math.sin(time * 4);
            } else {
                body.material.emissiveIntensity = 0;
                head.material.emissiveIntensity = 0;
            }

            const hp = group.userData.hp;
            const ratio = unit.currentWounds / unit.wounds;
            const hpW = HEX_3D * 0.9;
            hp.scale.x = ratio;
            hp.position.x = -hpW * (1 - ratio) / 2;
            hp.material.color.setHex(ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xff9800 : 0xe53935);
        }

        // Selection ring
        if (selected && !ctx.selectionRings.has(unit.id)) {
            const ringGeo = new THREE.TorusGeometry(ur + 0.06, 0.012, 8, 32);
            ringGeo.rotateX(Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: pc.ring, transparent: true, opacity: 0.8 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(x, th + 0.005, z);
            ctx.unitGroup.add(ring);
            ctx.selectionRings.set(unit.id, ring);
        } else if (selected && ctx.selectionRings.has(unit.id)) {
            const ring = ctx.selectionRings.get(unit.id);
            ring.position.set(x, th + 0.005, z);
            ring.material.opacity = 0.5 + 0.3 * Math.sin(time * 5);
            ring.scale.setScalar(1 + 0.05 * Math.sin(time * 3));
        } else if (!selected && ctx.selectionRings.has(unit.id)) {
            ctx.unitGroup.remove(ctx.selectionRings.get(unit.id));
            ctx.selectionRings.delete(unit.id);
        }
    });

    for (const [id, group] of ctx.unitMeshes) {
        if (!alive.has(id)) {
            ctx.unitGroup.remove(group);
            ctx.unitMeshes.delete(id);
            if (ctx.selectionRings.has(id)) {
                ctx.unitGroup.remove(ctx.selectionRings.get(id));
                ctx.selectionRings.delete(id);
            }
        }
    }
}

function updateEffects(ctx, state, time) {
    // Clear previous frame effects
    const rem = [];
    ctx.effectGroup.children.forEach(c => { if (c.userData.isEffect) rem.push(c); });
    rem.forEach(c => {
        ctx.effectGroup.remove(c);
        // Dispose only materials (sprites share cached textures)
        if (c.material) c.material.dispose();
        if (c.geometry) c.geometry.dispose();
    });

    const now = Date.now();
    let hasActiveEffects = false;

    // Floating damage numbers
    (state.hitEffects || []).forEach(effect => {
        const el = now - effect.time;
        if (el >= 500) return;
        hasActiveEffects = true;
        const p = el / 500;
        const { x, z } = hexToWorld(effect.hex.q, effect.hex.r);

        const sprite = makeSprite(`-${effect.damage}`, 80, "#ff3333", 1.2);
        sprite.position.set(x, 0.6 + p * 0.6, z);
        sprite.material.opacity = 1 - p * p;
        sprite.userData.isEffect = true;
        ctx.effectGroup.add(sprite);
    });

    // Dying units
    (state.dyingUnits || []).forEach(dying => {
        const el = now - dying.deathTime;
        if (el >= 600) return;
        hasActiveEffects = true;
        const p = el / 600;
        const { x, z } = hexToWorld(dying.hex.q, dying.hex.r);
        const k = hexKey(dying.hex);
        const terrain = getTerrainType(k, ctx);
        const th = HEIGHTS[terrain];
        const pc = dying.player === 1 ? COL.p1 : COL.p2;
        const s = 1 - p;
        const a = 1 - p;
        const ur = HEX_3D * 0.38;
        const uh = HEX_3D * 0.8;

        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(ur * 0.85, ur, uh * 0.7, 16),
            new THREE.MeshStandardMaterial({ color: pc.fill, transparent: true, opacity: a, roughness: 0.4 })
        );
        body.position.set(x, th + uh * 0.35 * s, z);
        body.scale.setScalar(s);
        body.rotation.z = p * Math.PI * 0.3;
        body.userData.isEffect = true;
        ctx.effectGroup.add(body);

        const sprite = makeSprite(dying.symbol, 80, "#fff");
        sprite.position.set(x, th + uh * s + 0.1, z);
        sprite.material.opacity = a;
        sprite.scale.setScalar(s);
        sprite.userData.isEffect = true;
        ctx.effectGroup.add(sprite);
    });

    // AI preview
    if (state.aiPreview) {
        hasActiveEffects = true;
        const pulse = 0.5 + 0.5 * Math.sin(time * 8);
        const { x, z } = hexToWorld(state.aiPreview.hex.q, state.aiPreview.hex.r);
        const k = hexKey(state.aiPreview.hex);
        const terrain = getTerrainType(k, ctx);
        const th = HEIGHTS[terrain];

        const rc = state.aiPreview.type === "attack" ? 0xff2020
            : state.aiPreview.type === "move" ? 0xd04040 : 0xd0a020;

        const ringGeo = new THREE.TorusGeometry(HEX_3D * 0.55, 0.018, 8, 32);
        ringGeo.rotateX(Math.PI / 2);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
            color: rc, transparent: true, opacity: 0.4 + pulse * 0.5,
        }));
        ring.position.set(x, th + 0.02, z);
        ring.scale.setScalar(1 + pulse * 0.08);
        ring.userData.isEffect = true;
        ctx.effectGroup.add(ring);
    }

    if (hasActiveEffects) ctx.needsAnimation = true;
}

export function updateScene(ctx, state, hoveredHex) {
    if (!state) return;

    // Check if state changed (triggers dirty)
    if (state !== ctx.lastState || hoveredHex !== ctx.lastHoveredHex) {
        ctx.dirty = true;
        ctx.lastState = state;
        ctx.lastHoveredHex = hoveredHex;
    }

    // Skip frame if nothing needs updating
    if (!ctx.dirty && !ctx.needsAnimation) return;

    ctx.needsAnimation = false;
    ctx.time += 0.016;

    getTerrainSets(ctx, state);
    updateTiles(ctx, state, hoveredHex, ctx.time);
    updateUnits(ctx, state, ctx.time);
    updateEffects(ctx, state, ctx.time);

    // Bake shadow map once after first full render (scene is static)
    if (!ctx.shadowBaked) {
        ctx.renderer.shadowMap.needsUpdate = true;
        ctx.shadowBaked = true;
    }

    ctx.renderer.render(ctx.scene, ctx.camera);
    ctx.dirty = false;
}

export function startRenderLoop(ctx, getState, getHoveredHex) {
    function animate() {
        ctx.animationId = requestAnimationFrame(animate);
        updateScene(ctx, getState(), getHoveredHex());
    }
    animate();
}

export function stopRenderLoop(ctx) {
    if (ctx.animationId) {
        cancelAnimationFrame(ctx.animationId);
        ctx.animationId = null;
    }
}

export function disposeScene(ctx) {
    stopRenderLoop(ctx);
    ctx.renderer.dispose();
    ctx.scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });
    if (ctx.renderer.domElement.parentNode) {
        ctx.renderer.domElement.parentNode.removeChild(ctx.renderer.domElement);
    }
    _spriteTexCache.forEach(tex => tex.dispose());
    _spriteTexCache.clear();
    for (const key in _sharedMats) {
        _sharedMats[key].dispose();
        delete _sharedMats[key];
    }
}
