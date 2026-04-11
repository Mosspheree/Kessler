import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
} from 'satellite.js';
import { EARTH_RADIUS, SCALE } from './constants.js';

/**
 * Convert latitude/longitude/altitude to 3D scene coordinates.
 * Returns a plain {x, y, z} object (no THREE dependency) for testability.
 */
export function llaToXYZ(lat, lon, alt) {
  const r = EARTH_RADIUS + alt * SCALE;
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return {
    x: r * Math.sin(phi) * Math.cos(theta),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta),
  };
}

/**
 * Propagate a satellite's position using SGP4.
 * Returns {lat, lon, alt} in degrees/km, or null on failure.
 */
export function propagateSatellite(satrec, date) {
  try {
    const gmst = gstime(date);
    const { position } = propagate(satrec, date);
    if (!position || !position.x) return null;
    const geo = eciToGeodetic(position, gmst);
    return {
      lat: degreesLat(geo.latitude),
      lon: degreesLong(geo.longitude),
      alt: geo.height,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a TLE into a satellite record for SGP4 propagation.
 */
export function parseTLE(line1, line2) {
  return twoline2satrec(line1, line2);
}

/**
 * Classify altitude into an orbital shell name.
 */
export function getOrbitalShell(altKm) {
  if (altKm < 2000) return 'LEO';
  if (altKm < 35000) return 'MEO';
  return 'GEO';
}
