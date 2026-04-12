import * as THREE from 'three';
import {
  COLORS,
  DEBRIS_PER_COLLISION,
  CASCADE_DEBRIS_COUNT,
  CASCADE_CHECK_START,
  CASCADE_CHECK_END,
  CASCADE_RANGE,
  CASCADE_PROBABILITY,
  GRAVITY_PULL,
  SURFACE_BOUNCE_FACTOR,
  EARTH_RADIUS,
} from './constants.js';
import { createDot } from './scene.js';

// ── Dot sizes (world-space sprite scale) ─────────────────────────────────────
// Sprites are much larger than the old SphereGeometry meshes were.
// Satellites: clearly visible, type-differentiated.
// Debris: smaller but still readable, more numerous.
const SIZE = {
  payload: 0.09,   // blue  — large, important satellites
  rocket:  0.08,   // orange — rocket bodies
  debris:  0.045,  // red   — existing catalogue debris (smaller)
  cascade: 0.038,  // magenta — freshly spawned collision debris
};

// coreFraction: how tight the bright core is (smaller = crisper dot)
const CORE = {
  payload: 0.20,
  rocket:  0.20,
  debris:  0.25,
  cascade: 0.25,
};

// ── Simulation state ─────────────────────────────────────────────────────────
export const state = {
  satellites: [],
  debrisFields: [],
  cascadeCount: 0,
  simTime: 0,
  running: false,
};

/**
 * Build satellite meshes from parsed TLE entries and add them to the scene.
 */
export function buildSatellites(tleEntries, scene) {
  state.satellites.forEach((s) => scene.remove(s.mesh));
  state.satellites = [];

  for (const entry of tleEntries) {
    const type = entry.type || 'payload';
    const mesh = createDot(
      COLORS[type] || COLORS.payload,
      SIZE[type]   || SIZE.payload,
      CORE[type]   || CORE.payload,
    );
    mesh.position.set(entry.scenePos.x, entry.scenePos.y, entry.scenePos.z);
    scene.add(mesh);

    state.satellites.push({
      name:   entry.name,
      satrec: entry.satrec,
      type,
      desc:   entry.desc,
      mesh,
      pos:    entry.pos,
    });
  }
}

/**
 * Spawn a cloud of debris fragments at the given position.
 */
export function spawnDebrisCloud(origin, count, isCascade, scene) {
  const frags = [];
  for (let i = 0; i < count; i++) {
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.003,
      (Math.random() - 0.5) * 0.003,
      (Math.random() - 0.5) * 0.003,
    );
    const mesh = createDot(
      isCascade ? COLORS.cascade : COLORS.debris,
      isCascade ? SIZE.cascade   : SIZE.debris,
      isCascade ? CORE.cascade   : CORE.debris,
    );
    const offset = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .normalize()
      .multiplyScalar(0.02);
    mesh.position.copy(origin).add(offset);
    scene.add(mesh);
    frags.push({ pos: mesh.position.clone(), vel, mesh });
  }
  state.debrisFields.push({ frags, age: 0, isCascade });
}

/**
 * Trigger a collision between two satellites.
 */
export function triggerCollision(indexA, indexB, scene, camera) {
  if (indexA === indexB) return null;

  const satA = state.satellites[indexA];
  const satB = state.satellites[indexB];
  if (!satA || !satB) return null;

  const collisionPos = satA.mesh.position.clone();

  // Flash white
  satA.mesh.material.color.set(0xffffff);
  satB.mesh.position.copy(collisionPos);
  satB.mesh.material.color.set(0xffffff);

  // Explosion ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.01, 0.003, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 1 }),
  );
  ring.position.copy(collisionPos);
  ring.lookAt(camera.position);
  scene.add(ring);

  let ringScale = 1;
  const expandRing = setInterval(() => {
    ringScale += 0.3;
    ring.scale.setScalar(ringScale);
    ring.material.opacity -= 0.05;
    if (ring.material.opacity <= 0) {
      clearInterval(expandRing);
      scene.remove(ring);
    }
  }, 30);

  // Destroy satellites + spawn debris after short delay
  setTimeout(() => {
    scene.remove(satA.mesh);
    scene.remove(satB.mesh);
    state.satellites = state.satellites.filter((s) => s !== satA && s !== satB);
    spawnDebrisCloud(collisionPos, DEBRIS_PER_COLLISION, false, scene);
    state.cascadeCount++;
    state.running = true;
  }, 600);

  return { collisionPos, satA, satB };
}

/**
 * Advance the debris physics and check for secondary cascades.
 */
export function updateDebris(dt, scene, onCascade) {
  state.simTime += dt;

  state.debrisFields.forEach((field) => {
    field.age += dt;

    field.frags.forEach((f) => {
      const toCenter = f.pos.clone().negate().normalize();
      f.vel.addScaledVector(toCenter, GRAVITY_PULL);
      f.pos.addScaledVector(f.vel, 1);
      f.mesh.position.copy(f.pos);

      if (f.pos.length() < EARTH_RADIUS * 1.01) {
        f.pos.normalize().multiplyScalar(EARTH_RADIUS * 1.05);
        f.vel.reflect(f.pos.clone().normalize()).multiplyScalar(SURFACE_BOUNCE_FACTOR);
      }
    });

    if (field.age > CASCADE_CHECK_START && field.age < CASCADE_CHECK_END) {
      const leadFragment = field.frags[0]?.mesh.position || new THREE.Vector3();
      state.satellites.forEach((sat) => {
        const dist = sat.mesh.position.distanceTo(leadFragment);
        if (dist < CASCADE_RANGE && Math.random() < CASCADE_PROBABILITY) {
          spawnDebrisCloud(sat.mesh.position.clone(), CASCADE_DEBRIS_COUNT, true, scene);
          scene.remove(sat.mesh);
          state.satellites = state.satellites.filter((s) => s !== sat);
          state.cascadeCount++;
          if (onCascade) onCascade(sat.name);
        }
      });
    }
  });
}

/**
 * Get current stats for the UI.
 */
export function getStats() {
  return {
    totalSatellites: state.satellites.length,
    totalDebris:     state.debrisFields.reduce((sum, d) => sum + d.frags.length, 0),
    cascadeCount:    state.cascadeCount,
    simTime:         state.simTime,
  };
}
