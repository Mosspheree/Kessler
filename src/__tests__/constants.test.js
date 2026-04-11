import { describe, it, expect } from 'vitest';
import {
  EARTH_RADIUS,
  SCALE,
  DEBRIS_PER_COLLISION,
  CASCADE_DEBRIS_COUNT,
  CASCADE_CHECK_START,
  CASCADE_CHECK_END,
  CASCADE_RANGE,
  CASCADE_PROBABILITY,
  GRAVITY_PULL,
  SURFACE_BOUNCE_FACTOR,
  COLORS,
  TLE_DATA,
} from '../constants.js';

describe('constants', () => {
  it('has sensible physics values', () => {
    expect(EARTH_RADIUS).toBe(1.0);
    expect(SCALE).toBeCloseTo(1 / 6371, 8);
    expect(DEBRIS_PER_COLLISION).toBeGreaterThan(0);
    expect(CASCADE_DEBRIS_COUNT).toBeGreaterThan(0);
    expect(CASCADE_DEBRIS_COUNT).toBeLessThan(DEBRIS_PER_COLLISION);
    expect(CASCADE_CHECK_START).toBeLessThan(CASCADE_CHECK_END);
    expect(CASCADE_RANGE).toBeGreaterThan(0);
    expect(CASCADE_PROBABILITY).toBeGreaterThan(0);
    expect(CASCADE_PROBABILITY).toBeLessThanOrEqual(1);
    expect(GRAVITY_PULL).toBeGreaterThan(0);
    expect(SURFACE_BOUNCE_FACTOR).toBeGreaterThan(0);
    expect(SURFACE_BOUNCE_FACTOR).toBeLessThan(1);
  });

  it('has all required object type colors', () => {
    expect(COLORS.payload).toBeDefined();
    expect(COLORS.rocket).toBeDefined();
    expect(COLORS.debris).toBeDefined();
    expect(COLORS.cascade).toBeDefined();
  });

  it('has TLE data with correct structure', () => {
    expect(TLE_DATA.length).toBeGreaterThan(0);
    TLE_DATA.forEach(([name, l1, l2, type, desc]) => {
      expect(typeof name).toBe('string');
      expect(l1).toMatch(/^1 /);
      expect(l2).toMatch(/^2 /);
      expect(['payload', 'rocket', 'debris']).toContain(type);
      expect(typeof desc).toBe('string');
    });
  });
});
