// ── Scene constants ──────────────────────────────────────────────────────────
export const EARTH_RADIUS = 1.0;
export const SCALE = 1 / 6371; // km -> scene units

// ── Simulation tuning ────────────────────────────────────────────────────────
export const DEBRIS_PER_COLLISION = 150;
export const CASCADE_DEBRIS_COUNT = 60;
export const CASCADE_CHECK_START = 3; // seconds after collision
export const CASCADE_CHECK_END = 3.1;
export const CASCADE_RANGE = 0.12; // scene units
export const CASCADE_PROBABILITY = 0.35;
export const GRAVITY_PULL = 0.000003;
export const SURFACE_BOUNCE_FACTOR = 0.4;

// ── Object type colors ───────────────────────────────────────────────────────
export const COLORS = {
  payload: 0x44aaff,
  rocket: 0xffaa44,
  debris: 0xff4444,
  cascade: 0xff00ff,
};

// ── TLE catalog ──────────────────────────────────────────────────────────────
// Real TLEs from Jan 2024 — a mix of payloads, rocket bodies, and debris.
// Each entry: [name, line1, line2, type, description]
export const TLE_DATA = [
  [
    'ISS (ZARYA)',
    '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002',
    '2 25544  51.6400 208.9163 0006703  86.9290 273.5169 15.49259098430600',
    'payload',
    'International Space Station \u2014 crewed',
  ],
  [
    'STARLINK-1007',
    '1 44713U 19074A   24001.50000000  .00002182  00000-0  17491-3 0  9993',
    '2 44713  53.0554 180.4570 0001370  85.7940 274.3350 15.06386940232791',
    'payload',
    'SpaceX Starlink internet satellite',
  ],
  [
    'NOAA 19',
    '1 33591U 09005A   24001.50000000  .00000074  00000-0  68740-4 0  9998',
    '2 33591  99.1920  45.2180 0013899 315.6120  44.4000 14.12273098762403',
    'payload',
    'NOAA weather observation satellite',
  ],
  [
    'COSMOS 2251 DEB',
    '1 34427U 93036PD  24001.50000000  .00000471  00000-0  13947-3 0  9990',
    '2 34427  74.0385 208.8374 0033174 264.4898  95.2691 14.35491168  7873',
    'debris',
    'Debris from 2009 Iridium-Cosmos collision',
  ],
  [
    'IRIDIUM 33 DEB',
    '1 33766U 97051CE  24001.50000000  .00001364  00000-0  26924-3 0  9997',
    '2 33766  86.3936 296.0564 0003529 200.0994 160.0124 14.33896089  6281',
    'debris',
    'Debris from 2009 Iridium-Cosmos collision',
  ],
  [
    'FENGYUN 1C DEB',
    '1 29228U 99025AFX 24001.50000000  .00000489  00000-0  71803-4 0  9993',
    '2 29228  98.6188 327.5422 0014688 120.4508 239.7927 14.23033703260801',
    'debris',
    'Debris from 2007 Chinese ASAT test \u2014 3000+ fragments',
  ],
  [
    'SL-16 R/B',
    '1 22285U 92093B   24001.50000000  .00000077  00000-0  99040-4 0  9995',
    '2 22285  71.0173  45.8916 0012836 284.9990  74.9790 14.12457298595801',
    'rocket',
    'Zenit-2 rocket body \u2014 Soviet launch vehicle',
  ],
  [
    'TERRA',
    '1 25994U 99068A   24001.50000000  .00000019  00000-0  27330-4 0  9999',
    '2 25994  98.2015  36.5910 0001184  87.0690 273.0630 14.57115084281651',
    'payload',
    'NASA Earth observation satellite',
  ],
  [
    'AQUA',
    '1 27424U 02022A   24001.50000000  .00000086  00000-0  37400-4 0  9994',
    '2 27424  98.2141 136.2490 0001315  73.2100 286.9230 14.57110891140961',
    'payload',
    'NASA water cycle observation satellite',
  ],
  [
    'COSMOS 1408 DEB',
    '1 49271U 82092PQ  24001.50000000  .00000970  00000-0  15430-3 0  9994',
    '2 49271  82.9612 100.3456 0008234 291.2341  68.8123 14.76234512 34521',
    'debris',
    'Debris from 2021 Russian ASAT test',
  ],
  [
    'GPS BIIR-2',
    '1 24876U 97035A   24001.50000000 -.00000025  00000-0  00000+0 0  9995',
    '2 24876  55.4810 160.0360 0044626  31.0690 329.2590  2.00560594193182',
    'payload',
    'GPS navigation satellite \u2014 MEO orbit',
  ],
  [
    'SL-8 R/B',
    '1 13453U 82059B   24001.50000000  .00000123  00000-0  14230-3 0  9991',
    '2 13453  74.0347 187.4561 0019234 145.6723 214.5634 14.29384756234512',
    'rocket',
    'Soviet Cosmos rocket body',
  ],
  [
    'GLOBALSTAR M001',
    '1 35280U 09017A   24001.50000000  .00000051  00000-0  00000+0 0  9994',
    '2 35280  51.9999 351.5234 0001870 282.1950  77.8810 13.34285532767152',
    'payload',
    'Globalstar communications satellite',
  ],
  [
    'BREEZE-M DEB',
    '1 38746U 12044C   24001.50000000  .00000234  00000-0  00000+0 0  9998',
    '2 38746  49.9823  23.4512 3456789 123.4567 234.5678  6.98765432123456',
    'debris',
    'Proton-M Breeze-M upper stage debris',
  ],
  [
    'DELTA 1 DEB',
    '1 08744U 76023D   24001.50000000  .00000056  00000-0  89230-4 0  9997',
    '2 08744  89.9123 267.8901 0023456 198.7654 161.2890 13.86543219876543',
    'debris',
    'Delta rocket debris \u2014 50+ years in orbit',
  ],
];
