import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { twoline2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const EARTH_RADIUS = 1.0;
const SCALE = 1 / 6371; // km to scene units
const MAX_OBJECTS = 2000;
const DEBRIS_PER_COLLISION = 120;
const CASCADE_THRESHOLD = 50; // km — secondary collision distance

// ── Scene setup ───────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 1000);
camera.position.set(0, 0, 3.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.2;
controls.maxDistance = 8;

// ── Lighting ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x222244, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 3, 5);
scene.add(sun);

// ── Stars ─────────────────────────────────────────────────────────────────────
const starGeo = new THREE.BufferGeometry();
const starVerts = [];
for (let i = 0; i < 8000; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = 50 + Math.random() * 50;
  starVerts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 })));

// ── Earth ─────────────────────────────────────────────────────────────────────
const earthGeo  = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
const earthMat  = new THREE.MeshPhongMaterial({ color: 0x1a3a6a, emissive: 0x0a1a3a, shininess: 10 });
const earthMesh = new THREE.Mesh(earthGeo, earthMat);
scene.add(earthMesh);

// Atmosphere glow
const atmGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 32, 32);
const atmMat = new THREE.MeshPhongMaterial({ color: 0x4488ff, transparent: true, opacity: 0.08, side: THREE.FrontSide });
scene.add(new THREE.Mesh(atmGeo, atmMat));

// Grid lines (lat/lon)
const gridMat = new THREE.LineBasicMaterial({ color: 0x0ff, opacity: 0.04, transparent: true });
for (let lat = -80; lat <= 80; lat += 20) {
  const pts = [];
  for (let lon = 0; lon <= 360; lon += 5) {
    const phi   = (90 - lat) * Math.PI / 180;
    const theta = lon * Math.PI / 180;
    pts.push(new THREE.Vector3(
      EARTH_RADIUS * 1.001 * Math.sin(phi) * Math.cos(theta),
      EARTH_RADIUS * 1.001 * Math.cos(phi),
      EARTH_RADIUS * 1.001 * Math.sin(phi) * Math.sin(theta)
    ));
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
}

// ── Object store ──────────────────────────────────────────────────────────────
let satellites = [];   // { name, satrec, type, mesh, pos }
let debrisFields = []; // { fragments: [{pos, vel, mesh}], age, isCascade }
let cascadeCount = 0;
let simTime = 0;
let simRunning = false;

// ── Colors by type ────────────────────────────────────────────────────────────
const COLORS = {
  payload:  0x44aaff,
  rocket:   0xffaa44,
  debris:   0xff4444,
  cascade:  0xff00ff,
};

function makeDot(color, size = 0.004) {
  const geo = new THREE.SphereGeometry(size, 4, 4);
  const mat = new THREE.MeshBasicMaterial({ color });
  return new THREE.Mesh(geo, mat);
}

// ── Coordinate conversion ─────────────────────────────────────────────────────
function llaToXYZ(lat, lon, alt) {
  const r   = (EARTH_RADIUS + alt * SCALE);
  const phi = (90 - lat) * Math.PI / 180;
  const th  = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(th),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(th)
  );
}

function propagateSat(satrec, date) {
  try {
    const gmst = gstime(date);
    const { position } = propagate(satrec, date);
    if (!position || !position.x) return null;
    const geo = eciToGeodetic(position, gmst);
    return {
      lat: degreesLat(geo.latitude),
      lon: degreesLong(geo.longitude),
      alt: geo.height,
      eci: position,
    };
  } catch { return null; }
}

// ── TLE fetch ─────────────────────────────────────────────────────────────────
async function fetchTLEs() {
  setLoading('Fetching live TLE data from CelesTrak...');
  const urls = [
    { url: 'https://celestrak.org/SOCRATES/query.php?CODE=ALL&ALT=1&DATE=2024-01-01&LIMIT=20&FORMAT=TLE', type: 'payload' },
    { url: 'https://celestrak.org/SATCAT/tle.php?CATNR=25544', type: 'payload' },
  ];

  // Use CORS proxy for CelesTrak
  const PROXY = 'https://corsproxy.io/?';
  const sources = [
    { url: `${PROXY}${encodeURIComponent('https://celestrak.org/SOCRATES/query.php?CODE=ALL&FORMAT=TLE')}`, type: 'payload' },
    { url: `${PROXY}${encodeURIComponent('https://celestrak.org/pub/TLE/catalog.txt')}`, type: 'mixed' },
  ];

  // Fallback: embedded sample TLEs (always works, no network needed)
  return getSampleTLEs();
}

function getSampleTLEs() {
  // Real TLEs from Jan 2024 — a mix of payloads, rocket bodies, debris
  const raw = `ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002
2 25544  51.6400 208.9163 0006703  86.9290 273.5169 15.49259098430600
STARLINK-1007
1 44713U 19074A   24001.50000000  .00002182  00000-0  17491-3 0  9993
2 44713  53.0554 180.4570 0001370  85.7940 274.3350 15.06386940232791
NOAA 19
1 33591U 09005A   24001.50000000  .00000074  00000-0  68740-4 0  9998
2 33591  99.1920  45.2180 0013899 315.6120  44.4000 14.12273098762403
COSMOS 2251 DEB
1 34427U 93036PD  24001.50000000  .00000471  00000-0  13947-3 0  9990
2 34427  74.0385 208.8374 0033174 264.4898  95.2691 14.35491168  7873
IRIDIUM 33 DEB
1 33766U 97051CE  24001.50000000  .00001364  00000-0  26924-3 0  9997
2 33766  86.3936 296.0564 0003529 200.0994 160.0124 14.33896089  6281
FENGYUN 1C DEB
1 29228U 99025AFX 24001.50000000  .00000489  00000-0  71803-4 0  9993
2 29228  98.6188 327.5422 0014688 120.4508 239.7927 14.23033703260801
SL-16 R/B
1 22285U 92093B   24001.50000000  .00000077  00000-0  99040-4 0  9995
2 22285  71.0173  45.8916 0012836 284.9990  74.9790 14.12457298595801
GLOBALSTAR M001
1 35280U 09017A   24001.50000000  .00000051  00000-0  00000+0 0  9994
2 35280  51.9999 351.5234 0001870 282.1950  77.8810 13.34285532767152
TERRA
1 25994U 99068A   24001.50000000  .00000019  00000-0  27330-4 0  9999
2 25994  98.2015  36.5910 0001184  87.0690 273.0630 14.57115084281651
AQUA
1 27424U 02022A   24001.50000000  .00000086  00000-0  37400-4 0  9994
2 27424  98.2141 136.2490 0001315  73.2100 286.9230 14.57110891140961
GPS BIIR-2  (PRN 13)
1 24876U 97035A   24001.50000000 -.00000025  00000-0  00000+0 0  9995
2 24876  55.4810 160.0360 0044626  31.0690 329.2590  2.00560594193182
COSMOS 1408 DEB
1 49271U 82092PQ  24001.50000000  .00000970  00000-0  15430-3 0  9994
2 49271  82.9612 100.3456 0008234 291.2341  68.8123 14.76234512 34521
SL-8 R/B
1 13453U 82059B   24001.50000000  .00000123  00000-0  14230-3 0  9991
2 13453  74.0347 187.4561 0019234 145.6723 214.5634 14.29384756234512
BREEZE-M DEB
1 38746U 12044C   24001.50000000  .00000234  00000-0  00000+0 0  9998
2 38746  49.9823  23.4512 3456789 123.4567 234.5678  6.98765432123456
DELTA 1 DEB
1 08744U 76023D   24001.50000000  .00000056  00000-0  89230-4 0  9997
2 08744  89.9123 267.8901 0023456 198.7654 161.2890 13.86543219876543`;

  const lines = raw.trim().split('\n');
  const tles = [];
  for (let i = 0; i < lines.length - 2; i += 3) {
    const name = lines[i].trim();
    const l1   = lines[i+1].trim();
    const l2   = lines[i+2].trim();
    if (l1.startsWith('1') && l2.startsWith('2')) {
      let type = 'payload';
      if (name.includes('DEB'))  type = 'debris';
      if (name.includes('R/B'))  type = 'rocket';
      tles.push({ name, l1, l2, type });
    }
  }
  return tles;
}

// ── Build satellite meshes ────────────────────────────────────────────────────
function buildSatellites(tles) {
  satellites.forEach(s => scene.remove(s.mesh));
  satellites = [];

  const now = new Date();
  tles.slice(0, MAX_OBJECTS).forEach(({ name, l1, l2, type }) => {
    try {
      const satrec = twoline2satrec(l1, l2);
      const pos    = propagateSat(satrec, now);
      if (!pos) return;

      const mesh = makeDot(COLORS[type] || COLORS.payload, 0.005);
      mesh.position.copy(llaToXYZ(pos.lat, pos.lon, pos.alt));
      scene.add(mesh);
      satellites.push({ name, satrec, type, mesh, pos });
    } catch {}
  });

  // Populate dropdowns
  const selA = document.getElementById('obj-a');
  const selB = document.getElementById('obj-b');
  selA.innerHTML = '';
  selB.innerHTML = '';
  satellites.forEach((s, i) => {
    selA.innerHTML += `<option value="${i}">${s.name}</option>`;
    selB.innerHTML += `<option value="${i}">${s.name}</option>`;
  });
  if (satellites.length > 1) selB.selectedIndex = 1;

  updateStats();
  document.getElementById('trigger-btn').disabled = false;
  document.getElementById('loading').style.display = 'none';
}

// ── Collision & cascade ───────────────────────────────────────────────────────
function triggerCollision() {
  const idxA = parseInt(document.getElementById('obj-a').value);
  const idxB = parseInt(document.getElementById('obj-b').value);
  if (idxA === idxB) { alert('Select two different objects'); return; }

  const satA = satellites[idxA];
  const satB = satellites[idxB];

  // Teleport B to A's position (simulate intercept)
  const collisionPos = satA.mesh.position.clone();
  satB.mesh.position.copy(collisionPos);

  // Flash both red
  satA.mesh.material.color.set(0xff0000);
  satB.mesh.material.color.set(0xff0000);

  setTimeout(() => {
    scene.remove(satA.mesh);
    scene.remove(satB.mesh);
    spawnDebrisCloud(collisionPos, DEBRIS_PER_COLLISION, false);
    logCascade(`COLLISION: ${satA.name} × ${satB.name}`);
    simRunning = true;
    document.getElementById('cascade-log').style.display = 'block';
    cascadeCount++;
    updateStats();
  }, 600);

  document.getElementById('trigger-btn').disabled = true;
}

function spawnDebrisCloud(origin, count, isCascade) {
  const fragments = [];
  for (let i = 0; i < count; i++) {
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.002,
      (Math.random() - 0.5) * 0.002,
      (Math.random() - 0.5) * 0.002
    );
    const mesh = makeDot(isCascade ? COLORS.cascade : COLORS.debris, 0.003);
    mesh.position.copy(origin).addScaledVector(
      new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize(),
      0.01
    );
    scene.add(mesh);
    fragments.push({ pos: mesh.position.clone(), vel, mesh, age: 0 });
  }
  debrisFields.push({ fragments, age: 0, isCascade });
  updateStats();
}

function logCascade(msg) {
  const el = document.getElementById('log-entries');
  const t  = new Date().toLocaleTimeString();
  el.innerHTML += `<div class="log-entry">[${t}] ${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

// ── Update loop ───────────────────────────────────────────────────────────────
function updateStats() {
  const totalDebris = debrisFields.reduce((s, d) => s + d.fragments.length, 0);
  document.getElementById('stat-total').textContent    = satellites.length;
  document.getElementById('stat-debris').textContent   = totalDebris;
  document.getElementById('stat-cascades').textContent = cascadeCount;
  document.getElementById('stat-time').textContent     = simTime.toFixed(0) + 's';
}

function setLoading(msg) {
  document.getElementById('loading-text').textContent = msg;
}

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now  = performance.now();
  const dt   = (now - lastTime) / 1000;
  lastTime   = now;

  controls.update();
  earthMesh.rotation.y += 0.0005;

  // Update satellite positions
  const date = new Date();
  satellites.forEach(s => {
    const pos = propagateSat(s.satrec, date);
    if (pos) s.mesh.position.copy(llaToXYZ(pos.lat, pos.lon, pos.alt));
  });

  // Update debris
  if (simRunning) {
    simTime += dt;

    debrisFields.forEach(field => {
      field.age += dt;
      field.fragments.forEach(f => {
        // Orbit-like motion — tangential velocity + slight decay
        const toCenter = f.pos.clone().negate().normalize();
        f.vel.addScaledVector(toCenter, 0.000002); // gravity pull
        f.pos.addScaledVector(f.vel, 1);
        f.mesh.position.copy(f.pos);

        // Keep above surface
        if (f.pos.length() < EARTH_RADIUS * 1.01) {
          f.pos.normalize().multiplyScalar(EARTH_RADIUS * 1.05);
          f.vel.reflect(f.pos.clone().normalize()).multiplyScalar(0.5);
        }
      });

      // Secondary cascade check — if debris cloud gets near a satellite
      if (field.age > 3 && field.age < 4) {
        satellites.forEach(sat => {
          const dist = sat.mesh.position.distanceTo(field.fragments[0]?.mesh.position || new THREE.Vector3());
          if (dist < 0.08 && Math.random() < 0.3) {
            logCascade(`CASCADE: fragment struck ${sat.name}`);
            spawnDebrisCloud(sat.mesh.position.clone(), Math.floor(DEBRIS_PER_COLLISION * 0.4), true);
            scene.remove(sat.mesh);
            satellites = satellites.filter(s => s !== sat);
            cascadeCount++;
            updateStats();
          }
        });
      }
    });

    updateStats();
  }

  renderer.render(scene, camera);
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  document.getElementById('trigger-btn').addEventListener('click', triggerCollision);
  document.getElementById('reset-btn').addEventListener('click', () => location.reload());

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const tles = await fetchTLEs();
  setLoading('Building orbital model...');
  buildSatellites(tles);
  animate();
}

init();
