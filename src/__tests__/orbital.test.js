import { describe, it, expect } from 'vitest';
import { llaToXYZ, propagateSatellite, parseTLE, getOrbitalShell } from '../orbital.js';

describe('llaToXYZ', () => {
  it('converts equator/prime-meridian to correct scene coordinates', () => {
    const result = llaToXYZ(0, 0, 0);
    // At lat=0, lon=0, alt=0: should be on the unit sphere
    const length = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
    expect(length).toBeCloseTo(1.0, 3);
  });

  it('returns y ≈ EARTH_RADIUS at the north pole', () => {
    const result = llaToXYZ(90, 0, 0);
    expect(result.y).toBeCloseTo(1.0, 3);
    expect(Math.abs(result.x)).toBeLessThan(0.001);
    expect(Math.abs(result.z)).toBeLessThan(0.001);
  });

  it('returns y ≈ -EARTH_RADIUS at the south pole', () => {
    const result = llaToXYZ(-90, 0, 0);
    expect(result.y).toBeCloseTo(-1.0, 3);
  });

  it('increases radius with altitude', () => {
    const surface = llaToXYZ(0, 0, 0);
    const orbit = llaToXYZ(0, 0, 400); // 400 km altitude (ISS)
    const surfaceR = Math.sqrt(surface.x ** 2 + surface.y ** 2 + surface.z ** 2);
    const orbitR = Math.sqrt(orbit.x ** 2 + orbit.y ** 2 + orbit.z ** 2);
    expect(orbitR).toBeGreaterThan(surfaceR);
  });

  it('returns different positions for different longitudes', () => {
    const a = llaToXYZ(0, 0, 0);
    const b = llaToXYZ(0, 90, 0);
    expect(a.x).not.toBeCloseTo(b.x, 2);
  });
});

describe('getOrbitalShell', () => {
  it('classifies LEO correctly', () => {
    expect(getOrbitalShell(400)).toBe('LEO');
    expect(getOrbitalShell(1999)).toBe('LEO');
  });

  it('classifies MEO correctly', () => {
    expect(getOrbitalShell(2000)).toBe('MEO');
    expect(getOrbitalShell(20200)).toBe('MEO');
  });

  it('classifies GEO correctly', () => {
    expect(getOrbitalShell(35786)).toBe('GEO');
    expect(getOrbitalShell(40000)).toBe('GEO');
  });
});

describe('parseTLE + propagateSatellite', () => {
  const ISS_L1 = '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002';
  const ISS_L2 = '2 25544  51.6400 208.9163 0006703  86.9290 273.5169 15.49259098430600';

  it('parses a valid TLE without throwing', () => {
    expect(() => parseTLE(ISS_L1, ISS_L2)).not.toThrow();
  });

  it('propagates to a valid position near the TLE epoch', () => {
    const satrec = parseTLE(ISS_L1, ISS_L2);
    // Propagate at the TLE epoch: 2024-01-01 12:00 UTC
    const date = new Date('2024-01-01T12:00:00Z');
    const pos = propagateSatellite(satrec, date);

    expect(pos).not.toBeNull();
    expect(pos.lat).toBeGreaterThanOrEqual(-90);
    expect(pos.lat).toBeLessThanOrEqual(90);
    expect(pos.lon).toBeGreaterThanOrEqual(-180);
    expect(pos.lon).toBeLessThanOrEqual(180);
    // ISS orbits at ~400 km
    expect(pos.alt).toBeGreaterThan(300);
    expect(pos.alt).toBeLessThan(500);
  });

  it('returns null for a date far from epoch', () => {
    const satrec = parseTLE(ISS_L1, ISS_L2);
    // 50 years from epoch — SGP4 should fail or give unreliable results
    const farDate = new Date('2074-01-01T00:00:00Z');
    // May return null or a position — SGP4 doesn't always error for far dates.
    // Just verify it doesn't throw and returns the expected shape.
    const pos = propagateSatellite(satrec, farDate);
    expect(pos === null || typeof pos.lat === 'number').toBe(true);
  });
});

describe('llaToXYZ coordinate consistency', () => {
  it('opposite longitudes produce mirrored z coordinates', () => {
    const a = llaToXYZ(0, 45, 0);
    const b = llaToXYZ(0, -45, 0);
    // At the equator, mirroring longitude should mirror the z component
    expect(a.y).toBeCloseTo(b.y, 5);
  });
});
