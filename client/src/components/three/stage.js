/**
 * stage.js — reusable Three.js stage: renderer, scene, lights, camera,
 * OrbitControls (rotate/zoom), a raycaster-based picker, an animation loop, and
 * a ResizeObserver. Renderer-agnostic helper; board components add their meshes.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import InputManager from './InputManager.js';

const IS_MOBILE = typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

export function createStage(container, { camera: camPos = [0, 13, 13], target = [0, 0, 0], pick, theme = 'neon' } = {}) {
  const scene = new THREE.Scene();

  const w = container.clientWidth || 560;
  const h = container.clientHeight || 560;
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 200);
  camera.position.set(...camPos);

  const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, alpha: true, powerPreference: 'high-performance' });
  // Clamp pixel ratio so high-DPI phones (iPhone @3x) don't render 9× the pixels.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.75 : 2));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;
  // Cheaper shadows on mobile to save battery / keep FPS high.
  renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // ---- lighting (warm studio for chess, neon for ludo) ----
  const warm = theme === 'warm';
  scene.add(new THREE.AmbientLight(warm ? 0xfff2e0 : 0x8088ff, warm ? 0.7 : 0.55));
  const key = new THREE.DirectionalLight(warm ? 0xfff4e2 : 0xffffff, warm ? 2.0 : 1.5);
  key.position.set(6, 16, 9); key.castShadow = true;
  key.shadow.mapSize.set(IS_MOBILE ? 512 : 1024, IS_MOBILE ? 512 : 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 60;
  key.shadow.camera.left = -16; key.shadow.camera.right = 16;
  key.shadow.camera.top = 16; key.shadow.camera.bottom = -16;
  key.shadow.bias = -0.0004;
  scene.add(key);
  if (warm) {
    const fill = new THREE.DirectionalLight(0xffe8c8, 0.7); fill.position.set(-8, 8, -6); scene.add(fill);
    const rim = new THREE.PointLight(0xfff0d8, 0.6, 60); rim.position.set(0, 6, -12); scene.add(rim);
  } else {
    const p1 = new THREE.PointLight(0x7b61ff, 0.9, 60); p1.position.set(-12, 8, -10); scene.add(p1);
    const p2 = new THREE.PointLight(0x00d4ff, 0.7, 60); p2.position.set(12, 6, 12); scene.add(p2);
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 9;
  controls.maxDistance = 34;
  controls.maxPolarAngle = Math.PI * 0.49; // don't go under the board
  controls.update();

  // ---- raycaster picking via the unified touch/mouse InputManager ----
  // NDC is computed from the live canvas rect (margins/padding/scroll aware); a
  // movement threshold suppresses camera drags so panning ≠ clicking a piece.
  const raycaster = new THREE.Raycaster();
  const input = new InputManager(renderer.domElement, {
    dragThreshold: IS_MOBILE ? 12 : 8,
    onPick: (ndc) => { if (!pick) return; raycaster.setFromCamera(ndc, camera); pick(raycaster); },
  });

  // ---- loop ----
  const updaters = new Set();
  let raf;
  const clock = new THREE.Clock();
  const loop = () => {
    const dt = clock.getDelta(), t = clock.elapsedTime;
    updaters.forEach((fn) => fn(dt, t));
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  // ---- resize / orientation change ----
  const applySize = () => {
    const nw = container.clientWidth, nh = container.clientHeight || nw;
    if (!nw) return;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.75 : 2));
  };
  const ro = new ResizeObserver(applySize);
  ro.observe(container);
  // orientationchange fires BEFORE layout settles on iOS/Android → recalc after a tick
  const onOrient = () => { applySize(); setTimeout(applySize, 250); };
  window.addEventListener('orientationchange', onOrient);
  window.addEventListener('resize', applySize);

  return {
    scene, camera, renderer, controls, raycaster,
    onFrame: (fn) => { updaters.add(fn); return () => updaters.delete(fn); },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('orientationchange', onOrient);
      window.removeEventListener('resize', applySize);
      input.dispose();
      controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    },
  };
}

export { THREE };
