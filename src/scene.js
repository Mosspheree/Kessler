import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EARTH_RADIUS } from './constants.js';

/**
 * Create the full Three.js scene: renderer, camera, controls,
 * earth, atmosphere, continents, starfield, orbital shells, and grid.
 *
 * Returns all objects the rest of the app needs to reference.
 */
export function createScene(container) {
  // ── Renderer ─────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // ── Scene & camera ───────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.001,
    1000,
  );
  camera.position.set(0, 0, 3.8);

  // ── Controls ─────────────────────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.3;
  controls.maxDistance = 10;

  // ── Lighting ─────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x223355, 3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(5, 3, 5);
  scene.add(sun);

  // ── Stars ────────────────────────────────────────────────────────────────
  const starVerts = [];
  for (let i = 0; i < 10000; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 50 + Math.random() * 50;
    starVerts.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.04 })));

  // ── Earth ────────────────────────────────────────────────────────────────
  const earthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
    new THREE.MeshPhongMaterial({ color: 0x1a3a6a, emissive: 0x081828, shininess: 20 }),
  );
  scene.add(earthMesh);

  // Continents (rough Lambert-zone outlines)
  const continentMat = new THREE.MeshPhongMaterial({
    color: 0x2d5a27,
    emissive: 0x0a1a08,
    shininess: 5,
  });
  [
    [0.3, 0.15, 0.4, 0.5],
    [0.55, 0.1, 0.25, 0.45],
    [0.15, 0.55, 0.2, 0.3],
  ].forEach(([lat, lon, w, h]) => {
    const geo = new THREE.SphereGeometry(
      EARTH_RADIUS * 1.001,
      16,
      16,
      lon * Math.PI * 2,
      w * Math.PI * 2,
      (0.5 - lat) * Math.PI,
      h * Math.PI,
    );
    scene.add(new THREE.Mesh(geo, continentMat));
  });

  // Atmosphere glow
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.025, 32, 32),
      new THREE.MeshPhongMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.06,
        side: THREE.FrontSide,
      }),
    ),
  );

  // ── Orbital shells (LEO, MEO, GEO rings) ────────────────────────────────
  [
    [1.063, 0x00ffff, 0.03],
    [1.35, 0xffaa00, 0.02],
    [1.65, 0xff44ff, 0.015],
  ].forEach(([r, color, opacity]) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.002, 8, 120),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
    );
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
  });

  // ── Lat/lon grid ─────────────────────────────────────────────────────────
  const gridMat = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    opacity: 0.04,
    transparent: true,
  });
  for (let lat = -80; lat <= 80; lat += 20) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 5) {
      const phi = ((90 - lat) * Math.PI) / 180;
      const th = (lon * Math.PI) / 180;
      const r = EARTH_RADIUS * 1.001;
      pts.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(th),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(th),
        ),
      );
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }

  // ── Resize handler ───────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, controls, earthMesh };
}

/**
 * Create a small sphere mesh to represent a satellite or debris fragment.
 */
export function createDot(color, size = 0.006) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(size, 6, 6),
    new THREE.MeshBasicMaterial({ color }),
  );
}
