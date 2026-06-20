import { useEffect, useRef } from 'react';
import { createStage, THREE } from '../three/stage.js';

const FILES = 'abcdefgh';
const V = (x, y) => new THREE.Vector2(x, y);

// Refined Staunton silhouettes (radius, height) revolved with LatheGeometry.
const PROFILES = {
  p: [V(0, 0), V(0.33, 0), V(0.35, 0.05), V(0.29, 0.1), V(0.17, 0.16), V(0.13, 0.25), V(0.185, 0.31), V(0.1, 0.39)],
  r: [V(0, 0), V(0.37, 0), V(0.39, 0.05), V(0.32, 0.11), V(0.21, 0.18), V(0.2, 0.54), V(0.29, 0.6), V(0.29, 0.68)],
  b: [V(0, 0), V(0.35, 0), V(0.37, 0.05), V(0.29, 0.11), V(0.16, 0.2), V(0.12, 0.36), V(0.17, 0.5), V(0.07, 0.66)],
  n: [V(0, 0), V(0.36, 0), V(0.38, 0.05), V(0.3, 0.11), V(0.2, 0.2), V(0.18, 0.36)],
  q: [V(0, 0), V(0.4, 0), V(0.42, 0.05), V(0.34, 0.12), V(0.18, 0.24), V(0.14, 0.52), V(0.19, 0.64), V(0.12, 0.74)],
  k: [V(0, 0), V(0.42, 0), V(0.44, 0.05), V(0.36, 0.13), V(0.19, 0.26), V(0.15, 0.58), V(0.2, 0.7), V(0.13, 0.82)],
};

function buildPiece(type, color) {
  const g = new THREE.Group();
  const mat = color === 'w'
    ? new THREE.MeshStandardMaterial({ color: 0xf4ead4, metalness: 0.0, roughness: 0.3 })
    : new THREE.MeshStandardMaterial({ color: 0x1f1e24, metalness: 0.0, roughness: 0.26 });
  const add = (geo, y = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.y = y; m.scale.set(sx, sy, sz);
    m.castShadow = true; g.add(m); return m;
  };
  add(new THREE.LatheGeometry(PROFILES[type], 32));
  switch (type) {
    case 'p': add(new THREE.SphereGeometry(0.16, 22, 18), 0.44); break;
    case 'b': // mitre: tapered cone + ball tip
      add(new THREE.ConeGeometry(0.17, 0.26, 24), 0.62); add(new THREE.SphereGeometry(0.06, 14, 12), 0.82);
      break;
    case 'r': { // solid castle cap + clear box merlons (battlements)
      add(new THREE.CylinderGeometry(0.3, 0.28, 0.12, 24), 0.7);
      for (let i = 0; i < 5; i++) { const b = add(new THREE.BoxGeometry(0.11, 0.14, 0.11), 0.82); b.position.x = Math.cos(i * 2 * Math.PI / 5) * 0.2; b.position.z = Math.sin(i * 2 * Math.PI / 5) * 0.2; }
      break;
    }
    case 'n': { // horse head from a few primitives, tilted forward
      const head = new THREE.Group(); head.position.y = 0.5;
      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.2), mat); skull.castShadow = true; head.add(skull);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.24), mat); snout.position.set(0, 0.02, 0.18); snout.castShadow = true; head.add(snout);
      [-0.06, 0.06].forEach((x) => { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), mat); ear.position.set(x, 0.2, -0.04); ear.castShadow = true; head.add(ear); });
      head.rotation.x = -0.25; g.add(head);
      break;
    }
    case 'q': // coronet of spikes around a central orb
      add(new THREE.SphereGeometry(0.2, 24, 18), 0.78);
      for (let i = 0; i < 8; i++) { const s = add(new THREE.ConeGeometry(0.05, 0.16, 10), 0.92); s.position.x = Math.cos(i * Math.PI / 4) * 0.17; s.position.z = Math.sin(i * Math.PI / 4) * 0.17; }
      add(new THREE.SphereGeometry(0.06, 12, 10), 0.98);
      break;
    case 'k': // orb + cross
      add(new THREE.SphereGeometry(0.17, 22, 18), 0.84);
      add(new THREE.BoxGeometry(0.09, 0.34, 0.09), 1.06); add(new THREE.BoxGeometry(0.26, 0.09, 0.09), 1.12);
      break;
    default: break;
  }
  return g;
}

const LIGHT = '#f0d9b5', DARK = '#b58863';

export default function ChessBoard3D({ board = [], selected, legalTargets = [], onSquare, flipped }) {
  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const cb = useRef({});
  cb.current = { onSquare };

  useEffect(() => {
    const stage = createStage(mountRef.current, {
      camera: [0, 9, 9.6], theme: 'warm',
      pick: (ray) => {
        const hit = ray.intersectObjects(boardGroup.children, true)
          .map((h) => { let o = h.object; while (o && !o.userData.square) o = o.parent; return o; })
          .find(Boolean);
        if (hit) cb.current.onSquare?.(hit.userData.square);
      },
    });
    const { scene } = stage;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 9.6),
      new THREE.MeshStandardMaterial({ color: 0x5b3f25, metalness: 0.2, roughness: 0.55 }));
    frame.position.y = -0.22; frame.receiveShadow = true; scene.add(frame);
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.06, 8.3),
      new THREE.MeshStandardMaterial({ color: 0x3a2715, roughness: 0.6 }));
    inlay.position.y = 0.02; scene.add(inlay);

    const boardGroup = new THREE.Group(); scene.add(boardGroup);
    if (flipped) boardGroup.rotation.y = Math.PI;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const dark = (r + c) % 2 === 1;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(dark ? DARK : LIGHT), roughness: 0.5, metalness: 0.05 }));
      tile.position.set(c - 3.5, 0.06, r - 3.5);
      tile.receiveShadow = true; tile.userData.square = `${FILES[c]}${8 - r}`;
      boardGroup.add(tile);
    }

    const pieces = new THREE.Group(), markers = new THREE.Group();
    boardGroup.add(pieces); boardGroup.add(markers);
    apiRef.current = { stage, boardGroup, pieces, markers };
    stage.onFrame((dt, t) => { markers.children.forEach((m) => { m.position.y = 0.22 + Math.sin(t * 4) * 0.05; }); });

    return () => { stage.dispose(); apiRef.current = null; };
    // eslint-disable-next-line
  }, [flipped]);

  useEffect(() => {
    const api = apiRef.current; if (!api) return;
    const rebuild = () => {
      const { pieces, markers, boardGroup } = api;
      [pieces, markers].forEach((grp) => {
        while (grp.children.length) {
          const m = grp.children.pop();
          m.traverse?.((o) => { o.material?.dispose?.(); o.geometry?.dispose?.(); });
        }
      });
      board.forEach((row, r) => row.forEach((sq, c) => {
        if (!sq) return;
        const p = buildPiece(sq.type, sq.color);
        p.position.set(c - 3.5, 0.12, r - 3.5);
        p.userData.square = `${FILES[c]}${8 - r}`;
        pieces.add(p);
      }));
      boardGroup.children.forEach((t) => { if (t.userData.square && t.material?.emissive) t.material.emissive.set(t.userData.square === selected ? '#6f5a2a' : '#000000'); });
      legalTargets.forEach((tg) => {
        const c = FILES.indexOf(tg.to[0]), r = 8 - +tg.to[1];
        const mk = new THREE.Mesh(
          tg.capture ? new THREE.TorusGeometry(0.42, 0.06, 10, 22) : new THREE.CylinderGeometry(0.15, 0.15, 0.05, 18),
          new THREE.MeshStandardMaterial({ color: new THREE.Color(tg.capture ? '#c0392b' : '#2e7d32'), emissive: new THREE.Color(tg.capture ? '#c0392b' : '#2e7d32'), emissiveIntensity: 0.6 }));
        if (tg.capture) mk.rotation.x = Math.PI / 2;
        mk.position.set(c - 3.5, 0.22, r - 3.5);
        markers.add(mk);
      });
    };
    api.rebuild = rebuild;
    rebuild();
    // eslint-disable-next-line
  }, [board, selected, legalTargets]);

  return <div ref={mountRef} className="ludo3d" />;
}
