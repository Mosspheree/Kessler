import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EARTH_RADIUS } from './constants.js';

// ── GLSL: Earth day/night shader ─────────────────────────────────────────────

const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv       = uv;
    vNormal   = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EARTH_FRAG = /* glsl */ `
  uniform sampler2D tDay;
  uniform sampler2D tNight;
  uniform sampler2D tSpecular;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3  N     = normalize(vNormal);
    float NdotL = dot(N, normalize(sunDirection));
    float blend = smoothstep(-0.2, 0.25, NdotL);
    vec3 day   = texture2D(tDay,   vUv).rgb;
    vec3 night = texture2D(tNight, vUv).rgb * 2.5;
    vec3 col   = mix(night, day, blend);
    float spec    = texture2D(tSpecular, vUv).r;
    vec3  viewDir = normalize(cameraPosition - vWorldPos);
    vec3  halfDir = normalize(normalize(sunDirection) + viewDir);
    float shine   = pow(max(dot(N, halfDir), 0.0), 80.0) * spec * blend;
    col += vec3(0.8, 0.9, 1.0) * shine * 0.5;
    float rim = 1.0 - max(dot(N, viewDir), 0.0);
    col *= 1.0 - rim * rim * 0.4;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const ATMOS_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOS_FRAG = /* glsl */ `
  uniform vec3 sunDirection;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3  N       = normalize(vNormal);
    vec3  viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(N, viewDir), 0.0), 3.5);
    float sunGlow = smoothstep(-0.4, 0.6, dot(N, normalize(sunDirection))) * 0.4 + 0.6;
    vec3  color   = mix(vec3(0.1, 0.4, 0.9), vec3(0.3, 0.6, 1.0), fresnel) * sunGlow;
    gl_FragColor  = vec4(color, fresnel * 0.8);
  }
`;

const TEX_DAY =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg';
const TEX_NIGHT =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_lights_2048.png';
const TEX_SPECULAR =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_specular_2048.jpg';
const TEX_CLOUDS =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png';

// ── Satellite model factory ───────────────────────────────────────────────────

function makeGlow(hexColor, scale = 0.06) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const r = (hexColor >> 16) & 0xff;
  const g = (hexColor >> 8) & 0xff;
  const b = hexColor & 0xff;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.8)`);
  grad.addColorStop(0.3, `rgba(${r},${g},${b},0.3)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.scale.setScalar(scale);
  return glow;
}

/**
 * Create a realistic satellite/debris mesh based on type.
 */
export function createSatelliteMesh(type, hexColor) {
  const group = new THREE.Group();
  const color = new THREE.Color(hexColor);

  if (type === 'payload') {
    // Main bus body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.006, 0.006),
      new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        shininess: 80,
      }),
    );
    group.add(body);

    // Solar panels
    const panelMat = new THREE.MeshPhongMaterial({
      color: 0x1144cc,
      emissive: 0x002266,
      emissiveIntensity: 0.6,
      shininess: 120,
      side: THREE.DoubleSide,
    });
    [-1, 1].forEach((side) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.001, 0.009), panelMat);
      panel.position.x = side * 0.016;
      group.add(panel);

      // Panel frame
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(0.02, 0.001, 0.009)),
        new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.6 }),
      );
      frame.position.x = side * 0.016;
      group.add(frame);
    });

    // Antenna dish
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0002, 0.0002, 0.01, 4),
      new THREE.MeshBasicMaterial({ color: 0xcccccc }),
    );
    ant.position.y = 0.008;
    group.add(ant);

    // Dish top
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.002, 6, 4, 0, Math.PI),
      new THREE.MeshPhongMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide }),
    );
    dish.position.y = 0.013;
    group.add(dish);

    group.add(makeGlow(hexColor, 0.08));
  } else if (type === 'rocket') {
    // Cylinder body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.0035, 0.022, 10),
      new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.2,
        shininess: 60,
      }),
    );
    group.add(body);

    // Nozzle cone
    const nozzle = new THREE.Mesh(
      new THREE.ConeGeometry(0.004, 0.006, 8),
      new THREE.MeshPhongMaterial({ color: 0x444444, shininess: 30 }),
    );
    nozzle.position.y = -0.014;
    nozzle.rotation.z = Math.PI;
    group.add(nozzle);

    // Nose cone
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.003, 0.008, 8),
      new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 80 }),
    );
    nose.position.y = 0.015;
    group.add(nose);

    group.add(makeGlow(hexColor, 0.07));
  } else {
    // Debris / cascade — jagged irregular shard
    const size = type === 'cascade' ? 0.005 : 0.007;
    const geo = new THREE.TetrahedronGeometry(size, 0);

    // Randomize vertices slightly for irregular look
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) * (0.7 + Math.random() * 0.6),
        pos.getY(i) * (0.7 + Math.random() * 0.6),
        pos.getZ(i) * (0.7 + Math.random() * 0.6),
      );
    }
    geo.computeVertexNormals();

    const shard = new THREE.Mesh(
      geo,
      new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        shininess: 40,
        flatShading: true,
      }),
    );
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(shard);
    group.add(makeGlow(hexColor, type === 'cascade' ? 0.04 : 0.05));
  }

  return group;
}

/**
 * createDot kept for debris spawned mid-simulation.
 */
export function createDot(hexColor, _size = 0.07, _coreFraction = 0.18) {
  const type = hexColor === 0xff00ff ? 'cascade' : 'debris';
  return createSatelliteMesh(type, hexColor);
}

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
  scene.add(new THREE.AmbientLight(0x223344, 1.0));
  const sun = new THREE.DirectionalLight(0xfff5e0, 2.0);
  const SUN_DIR = new THREE.Vector3(5, 3, 5).normalize();
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  scene.add(sun);

  // Soft fill light from opposite side
  const fill = new THREE.DirectionalLight(0x334466, 0.4);
  fill.position.set(-5, -3, -5);
  scene.add(fill);

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
  const loader = new THREE.TextureLoader();
  const earthMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      tDay: { value: loader.load(TEX_DAY) },
      tNight: { value: loader.load(TEX_NIGHT) },
      tSpecular: { value: loader.load(TEX_SPECULAR) },
      sunDirection: { value: SUN_DIR },
    },
  });
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 64, 64), earthMat);
  scene.add(earthMesh);

  // ── Cloud layer ──────────────────────────────────────────────────────────
  const cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 64, 64),
    new THREE.MeshPhongMaterial({
      map: loader.load(TEX_CLOUDS),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(cloudMesh);

  // ── Atmosphere ───────────────────────────────────────────────────────────
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.06, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: ATMOS_VERT,
        fragmentShader: ATMOS_FRAG,
        uniforms: { sunDirection: { value: SUN_DIR } },
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );

  // ── Soft glow halo ───────────────────────────────────────────────────────
  const gc = document.createElement('canvas');
  gc.width = gc.height = 256;
  const gctx = gc.getContext('2d');
  const grad = gctx.createRadialGradient(128, 128, 40, 128, 128, 128);
  grad.addColorStop(0, 'rgba(70,130,255,0.15)');
  grad.addColorStop(0.5, 'rgba(50,100,220,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 256, 256);
  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(gc),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glowSprite.scale.set(EARTH_RADIUS * 2.8, EARTH_RADIUS * 2.8, 1);
  scene.add(glowSprite);

  // ── Orbital shells ───────────────────────────────────────────────────────
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

  return { scene, camera, renderer, controls, earthMesh, cloudMesh };
}
