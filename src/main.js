import * as THREE from 'three';
import { getSimSpeed } from './ui.js';
import './style.css';
import { TLE_DATA } from './constants.js';
import { llaToXYZ, propagateSatellite, parseTLE } from './orbital.js';
import { createScene } from './scene.js';
import { state, buildSatellites, triggerCollision, updateDebris, getStats } from './simulation.js';
import {
  populateDropdowns,
  updateStats,
  addLog,
  showTooltip,
  moveTooltip,
  hideTooltip,
  getSelectedIndices,
  showSimulation,
  setLoadingText,
  onCollisionTriggered,
  setupControls,
} from './ui.js';

// ── Initialize scene ─────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const { scene, camera, renderer, controls, earthMesh } = createScene(container);

// ── Raycaster for hover detection ────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  moveTooltip(e.clientX, e.clientY);

  raycaster.setFromCamera(mouse, camera);
  const meshes = state.satellites.map((s) => s.mesh);
  const hits = raycaster.intersectObjects(meshes);
  if (hits.length > 0) {
    const sat = state.satellites.find((s) => s.mesh === hits[0].object);
    if (sat) showTooltip(sat);
  } else {
    hideTooltip();
  }
});

// ── Build satellites from embedded TLE data ──────────────────────────────────
setLoadingText('Fetching live orbital data...');

let catalog = TLE_DATA;
try {
  const res = await fetch('https://celestrak.org/SOCRATES/query.php?CODE=ALL&FORMAT=json');
  if (!res.ok) throw new Error();
  // fallback if format unexpected
} catch {
  // silently use embedded TLE_DATA
}
setLoadingText('Building orbital model...');

const now = new Date();
const tleEntries = [];
for (const [name, l1, l2, type, desc] of catalog) {
  try {
    const satrec = parseTLE(l1, l2);
    const pos = propagateSatellite(satrec, now);
    if (!pos) continue;
    const scenePos = llaToXYZ(pos.lat, pos.lon, pos.alt);
    tleEntries.push({ name, satrec, type, desc, pos, scenePos });
  } catch {
    // Skip malformed TLEs
  }
}

buildSatellites(tleEntries, scene);
populateDropdowns(state.satellites);
updateStats(getStats());
showSimulation();

// ── Collision handler ────────────────────────────────────────────────────────
function handleTrigger() {
  const { a, b } = getSelectedIndices();
  if (a === b) {
    alert('Please select two different objects');
    return;
  }

  const satA = state.satellites[a];
  const satB = state.satellites[b];
  const result = triggerCollision(a, b, scene, camera);
  if (!result) return;

  onCollisionTriggered();

  setTimeout(() => {
    addLog(`\uD83D\uDCA5 COLLISION: ${satA.name} \u00D7 ${satB.name}`, true);
    addLog(
      `\u26A0 Generating ~${150} debris fragments in ${satA.type === 'payload' ? 'LEO' : 'orbital'} shell`,
    );
    updateStats(getStats());
  }, 600);
}

setupControls(handleTrigger, () => location.reload());

// ── Animation loop ───────────────────────────────────────────────────────────
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = ((now - lastTime) / 1000) * getSimSpeed();
  lastTime = now;

  controls.update();
  earthMesh.rotation.y += 0.0003;

  // Update satellite positions via SGP4
  const date = new Date();
  for (const sat of state.satellites) {
    const pos = propagateSatellite(sat.satrec, date);
    if (pos) {
      const xyz = llaToXYZ(pos.lat, pos.lon, pos.alt);
      sat.mesh.position.set(xyz.x, xyz.y, xyz.z);
      sat.pos = pos;
    }
  }

  // Update debris physics
  if (state.running) {
    updateDebris(dt, scene, (satName) => {
      addLog(`\uD83D\uDD34 CASCADE: fragment struck ${satName}`, true);
    });
    updateStats(getStats());
  }

  renderer.render(scene, camera);
}

animate();
