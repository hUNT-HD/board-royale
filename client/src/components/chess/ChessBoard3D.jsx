import { useEffect, useRef } from 'react';
import { createStage, THREE } from '../three/stage.js';

const FILES = 'abcdefgh';
const WHITE = '#f1e7cb', BLACK = '#3a3f4d';

// crude but readable 3D piece silhouettes from primitives
function buildPiece(type, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color === 'w' ? WHITE : BLACK),
    emissive: new THREE.Color(color === 'w' ? '#f4d58d' : '#d8dde6'),
    emissiveIntensity: 0.08, metalness: 0.55, roughness: 0.28,
  });
  const add = (geo, y, s = 1) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.scale.setScalar(s); m.castShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.32, 0.4, 0.18, 20), 0.09);     // base
  switch (type) {
    case 'p': add(new THREE.CylinderGeometry(0.16, 0.26, 0.32, 16), 0.34); add(new THREE.SphereGeometry(0.18, 16, 14), 0.62); break;
    case 'r': add(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 16), 0.45); add(new THREE.CylinderGeometry(0.3, 0.26, 0.16, 8), 0.76); break;
    case 'n': { add(new THREE.CylinderGeometry(0.2, 0.3, 0.4, 16), 0.4);
      const head = add(new THREE.BoxGeometry(0.5, 0.34, 0.22), 0.75); head.rotation.z = 0.4; break; }
    case 'b': add(new THREE.CylinderGeometry(0.16, 0.3, 0.55, 16), 0.48); add(new THREE.SphereGeometry(0.2, 16, 14), 0.82); add(new THREE.SphereGeometry(0.06, 8, 8), 1.0); break;
    case 'q': add(new THREE.CylinderGeometry(0.2, 0.32, 0.62, 18), 0.5); add(new THREE.SphereGeometry(0.26, 18, 16), 0.88); add(new THREE.SphereGeometry(0.09, 10, 10), 1.12); break;
    case 'k': add(new THREE.CylinderGeometry(0.22, 0.34, 0.66, 18), 0.52); add(new THREE.BoxGeometry(0.12, 0.34, 0.12), 1.0); add(new THREE.BoxGeometry(0.32, 0.12, 0.12), 1.06); break;
    default: break;
  }
  return g;
}

export default function ChessBoard3D({ board = [], selected, legalTargets = [], onSquare, flipped }) {
  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const cb = useRef({});
  cb.current = { onSquare };

  useEffect(() => {
    const stage = createStage(mountRef.current, {
      camera: [0, 9.5, 9.5],
      pick: (ray) => {
        const hit = ray.intersectObjects(boardGroup.children, true)
          .map((h) => { let o = h.object; while (o && !o.userData.square) o = o.parent; return o; })
          .find(Boolean);
        if (hit) cb.current.onSquare?.(hit.userData.square);
      },
    });
    const { scene } = stage;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.4, 9.4),
      new THREE.MeshStandardMaterial({ color: 0x14151f, metalness: 0.5, roughness: 0.5 }));
    frame.position.y = -0.2; frame.receiveShadow = true; scene.add(frame);

    const boardGroup = new THREE.Group(); scene.add(boardGroup);
    if (flipped) boardGroup.rotation.y = Math.PI;

    // 8×8 marble tiles
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const dark = (r + c) % 2 === 1;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 1),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(dark ? '#1b1b24' : '#e7eaf2'),
          metalness: dark ? 0.5 : 0.2, roughness: dark ? 0.5 : 0.35,
          emissive: new THREE.Color('#000000'),
        }));
      tile.position.set(c - 3.5, 0, r - 3.5);
      tile.receiveShadow = true;
      tile.userData.square = `${FILES[c]}${8 - r}`;
      boardGroup.add(tile);
    }

    const pieces = new THREE.Group(), markers = new THREE.Group();
    boardGroup.add(pieces); boardGroup.add(markers);
    apiRef.current = { stage, boardGroup, pieces, markers, tiles: boardGroup };

    stage.onFrame((dt, t) => { markers.children.forEach((m) => { m.position.y = 0.2 + Math.sin(t * 4) * 0.05; }); });

    return () => { stage.dispose(); apiRef.current = null; };
    // eslint-disable-next-line
  }, [flipped]);

  // rebuild pieces + highlights whenever the position changes
  useEffect(() => {
    const api = apiRef.current; if (!api) return;
    const { pieces, markers, boardGroup } = api;
    [pieces, markers].forEach((grp) => { while (grp.children.length) { const m = grp.children.pop(); m.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); } });

    board.forEach((row, r) => row.forEach((sq, c) => {
      if (!sq) return;
      const p = buildPiece(sq.type, sq.color);
      p.position.set(c - 3.5, 0.16, r - 3.5);
      p.userData.square = `${FILES[c]}${8 - r}`;
      pieces.add(p);
    }));

    // selection + legal targets
    boardGroup.children.forEach((t) => { if (t.userData.square && t.material) t.material.emissive.set(t.userData.square === selected ? '#f4d58d' : '#000000'); });
    legalTargets.forEach((tg) => {
      const [f, rk] = [FILES.indexOf(tg.to[0]), +tg.to[1]];
      const c = f, r = 8 - rk;
      const mk = new THREE.Mesh(
        tg.capture ? new THREE.TorusGeometry(0.42, 0.06, 8, 20) : new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(tg.capture ? '#ff5a78' : '#7b61ff'), emissive: new THREE.Color(tg.capture ? '#ff5a78' : '#7b61ff'), emissiveIntensity: 0.8 }));
      if (tg.capture) mk.rotation.x = Math.PI / 2;
      mk.position.set(c - 3.5, 0.2, r - 3.5);
      markers.add(mk);
    });
    // eslint-disable-next-line
  }, [board, selected, legalTargets]);

  return <div ref={mountRef} className="ludo3d" />;
}
