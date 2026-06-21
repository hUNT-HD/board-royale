import { useEffect, useRef } from 'react';
import { createStage, THREE } from '../three/stage.js';
import { MAIN, HOME, START, HEX, cellOf as sqCellOf } from './classic.js';
import * as HexC from './ludoHexCore.js';
import * as PentC from './ludoPentCore.js';

/* ---- square lookups ---- */
const mainIdx = {}; MAIN.forEach(([r, c], i) => { mainIdx[`${r},${c}`] = i; });
const homeColorAt = {}; Object.entries(HOME).forEach(([col, cs]) => cs.forEach(([r, c]) => { homeColorAt[`${r},${c}`] = col; }));
const startColorAt = {}; Object.entries(START).forEach(([col, i]) => { const [r, c] = MAIN[i]; startColorAt[`${r},${c}`] = col; });
const SQ_STAR = new Set([8, 21, 34, 47]);
const sqBase = (r, c) => (r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8);
const sqCenter = (r, c) => r >= 6 && r <= 8 && c >= 6 && c <= 8;

const HS = 0.16;                      // 0..100 core space → world units
const TILE_H = 0.22;
const colorObj = (hex) => new THREE.Color(hex);
const coreOf = (mode) => (mode === 'pent' ? PentC : HexC);

export default function LudoBoard3D({ mode, players = [], activeColor, movable = new Set(), onToken }) {
  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const geoRef = useRef(null);
  const cb = useRef({});
  cb.current = { players, activeColor, movable, onToken, mode };

  const worldOf = (color, rel, id) => {
    if (mode === 'square') { const [row, col] = sqCellOf(color, rel, id); return [col - 7, row - 7]; }
    const { core, geo } = geoRef.current;
    const p = core.tokenPos(geo, color, rel, id);
    return [(p.x - 50) * HS, (p.y - 50) * HS];
  };

  useEffect(() => {
    const core = coreOf(mode);
    const geo = mode === 'square' ? null : core.buildGeometry(100);
    geoRef.current = { core, geo };

    const stage = createStage(mountRef.current, {
      camera: mode === 'square' ? [0, 14, 14] : [0, 13, 13],
      pick: (ray) => {
        const hit = ray.intersectObjects(tokens.children, true)
          .map((h) => { let o = h.object; while (o && !o.userData.token) o = o.parent; return o; })
          .find((o) => o && o.userData.canMove);
        if (hit) cb.current.onToken?.(hit.userData.token.color, hit.userData.token.id);
      },
    });
    const { scene } = stage;
    const active = new Set(cb.current.players.map((p) => p.color));
    const tileMat = (hex, glow = 0) => new THREE.MeshStandardMaterial({
      color: colorObj(hex), emissive: colorObj(hex), emissiveIntensity: glow,
      metalness: 0.3, roughness: 0.45, transparent: !glow, opacity: glow ? 1 : 0.92,
    });
    const addTile = (x, z, w, d, mat, ry = 0, y = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, TILE_H, d), mat);
      m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m;
    };

    if (mode !== 'square') {
      const sides = mode === 'pent' ? 5 : 6;
      const w = (x, y) => [(x - 50) * HS, (y - 50) * HS];
      // dark plate
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.5, 0.4, sides),
        new THREE.MeshStandardMaterial({ color: 0x12131d, metalness: 0.4, roughness: 0.6 }));
      plate.position.y = -0.2; plate.rotation.y = Math.PI / sides; plate.receiveShadow = true; scene.add(plate);

      const SQ = geo.S * 0.9;
      geo.arms.forEach(({ color, cells }) => {
        const on = active.has(color);
        cells.forEach((c) => {
          const [x, z] = w(c.x, c.y);
          const isColor = c.home || c.start;
          const hex = isColor ? (on ? core.HEXC[color] : '#3a3d4d') : '#e9ebf2';
          addTile(x, z, SQ * HS, SQ * HS, tileMat(hex, isColor && on ? 0.45 : 0), -c.rot * Math.PI / 180);
        });
      });
      // coloured base discs
      core.ORDER.forEach((color) => {
        const b = geo.bases[color], on = active.has(color);
        const cxx = (b.tri[0].x + b.tri[1].x + b.tri[2].x) / 3, cyy = (b.tri[0].y + b.tri[1].y + b.tri[2].y) / 3;
        const [x, z] = w(cxx, cyy);
        const bm = new THREE.Mesh(new THREE.CylinderGeometry(geo.S * 1.5 * HS, geo.S * 1.6 * HS, 0.28, 26),
          on ? tileMat(core.HEXC[color], 0.4) : new THREE.MeshStandardMaterial({ color: 0x20222e, roughness: 0.7, transparent: true, opacity: 0.5 }));
        bm.position.set(x, 0.05, z); scene.add(bm);
      });
      // glowing centre hub
      const cverts = geo.hex || geo.pent;
      const hubR = Math.hypot(cverts[0].x - 50, cverts[0].y - 50) * HS;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR, 0.32, sides),
        new THREE.MeshStandardMaterial({ color: 0x0b3a5c, emissive: 0x00a0d8, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.4 }));
      hub.rotation.y = -Math.atan2(cverts[0].y - 50, cverts[0].x - 50) + Math.PI / 2;
      hub.position.y = 0.06; scene.add(hub);
    } else {
      for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
        let hex = null, glow = 0;
        if (sqBase(r, c)) {
          const color = c < 6 ? (r < 6 ? 'red' : 'blue') : (r < 6 ? 'green' : 'yellow');
          if (active.has(color)) { hex = HEX[color]; glow = 0.4; } else hex = '#23252f';
        } else if (sqCenter(r, c)) {
          const dir = r < 7 ? 'green' : r > 7 ? 'blue' : c < 7 ? 'red' : c > 7 ? 'yellow' : null;
          hex = dir && active.has(dir) ? HEX[dir] : '#191a26'; glow = dir && active.has(dir) ? 0.35 : 0;
        } else {
          const key = `${r},${c}`;
          const sCol = startColorAt[key], hCol = homeColorAt[key];
          const col = (sCol && active.has(sCol) && sCol) || (hCol && active.has(hCol) && hCol);
          if (col) { hex = HEX[col]; glow = 0.45; }
          else hex = SQ_STAR.has(mainIdx[key]) ? '#cfd3e0' : '#e9ebf2';
        }
        addTile(c - 7, r - 7, 0.94, 0.94, tileMat(hex, glow));
      }
      const plate = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.4, 15.6),
        new THREE.MeshStandardMaterial({ color: 0x12131d, metalness: 0.4, roughness: 0.6 }));
      plate.position.y = -0.2; plate.receiveShadow = true; scene.add(plate);
    }

    // ---- tokens ----
    const tokens = new THREE.Group(); scene.add(tokens);
    const tokenMap = new Map();
    const COLORS = mode === 'square' ? HEX : coreOf(mode).HEXC;
    cb.current.players.forEach((p) => p.tokens.forEach((t) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 20),
        new THREE.MeshStandardMaterial({ color: colorObj(COLORS[p.color]), emissive: colorObj(COLORS[p.color]), emissiveIntensity: 0.25, metalness: 0.1, roughness: 0.15 }));
      body.castShadow = true;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: colorObj(COLORS[p.color]), metalness: 0.2, roughness: 0.4 }));
      stem.position.y = -0.32;
      g.add(body); g.add(stem);
      g.userData.token = { color: p.color, id: t.id };
      const [x, z] = worldOf(p.color, t.rel, t.id);
      g.position.set(x, 0.55, z); g.userData.target = new THREE.Vector3(x, 0.55, z);
      tokens.add(g); tokenMap.set(`${p.color}-${t.id}`, g);
    }));

    stage.onFrame((dt, time) => {
      tokenMap.forEach((g) => {
        g.position.lerp(g.userData.target, Math.min(1, dt * 8));
        const pulse = g.userData.canMove ? 1.3 + Math.sin(time * 5) * 0.5 : 0.25;
        g.children[0].material.emissiveIntensity = pulse;
        g.position.y = g.userData.canMove ? 0.55 + Math.abs(Math.sin(time * 5)) * 0.18 : 0.55;
      });
    });

    apiRef.current = { stage, tokenMap, tokens };
    return () => { stage.dispose(); apiRef.current = null; };
    // eslint-disable-next-line
  }, [mode]);

  useEffect(() => {
    const api = apiRef.current; if (!api) return;
    cb.current.players.forEach((p) => p.tokens.forEach((t) => {
      const g = api.tokenMap.get(`${p.color}-${t.id}`); if (!g) return;
      const [x, z] = worldOf(p.color, t.rel, t.id);
      g.userData.target.set(x, 0.55, z);
      g.userData.token.canMove = movable.has(`${p.color}:${t.id}`);
      g.userData.canMove = g.userData.token.canMove;
    }));
    // eslint-disable-next-line
  }, [players.map((p) => p.tokens.map((t) => t.rel).join()).join('|'), [...movable].join(','), activeColor]);

  return <div ref={mountRef} className="ludo3d" />;
}
