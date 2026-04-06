# Kessler

> Real-time 3D space debris cascade simulator — visualize Kessler Syndrome using live orbital data.

## What is Kessler Syndrome?

In 1978, NASA scientist Donald Kessler proposed a catastrophic scenario: if the density of objects in low Earth orbit reaches a critical threshold, collisions between objects generate debris that triggers further collisions — a self-sustaining cascade that could render entire orbital shells unusable for centuries.

It is not science fiction. The 2009 Iridium-Cosmos collision generated over 2,000 trackable fragments. The 2007 Chinese ASAT test created over 3,000. Today, over 27,000 objects are tracked by the US Space Surveillance Network.

Kessler lets you simulate this cascade in real time.

## Features

- Real-time 3D Earth with orbital shell rings (LEO / MEO / GEO)
- Real satellites and debris using actual TLE orbital data
- Physics-based debris dispersal on collision
- Secondary cascade propagation
- Live cascade log with timestamps
- Hover any object for name, altitude, and orbital shell info
- Drag to rotate, scroll to zoom, reset anytime

## Tech Stack

- Three.js for 3D WebGL rendering
- satellite.js for SGP4 orbital propagation
- CelesTrak TLE catalog for real orbital data
- Vite build system

## Getting Started

Install dependencies and run:

    git clone https://github.com/Mosspheree/Kessler.git
    cd Kessler
    npm install
    npm run dev

Open http://localhost:5173 in your browser.

## How to Use

1. Select two objects from the dropdowns
2. Hover over objects to see their details
3. Click TRIGGER COLLISION
4. Watch the cascade unfold in real time

## References

- Kessler, D.J. and Cour-Palais, B.G. (1978). Collision Frequency of Artificial Satellites.
- CelesTrak TLE Catalog: https://celestrak.org
- NASA Orbital Debris Program: https://orbitaldebris.jsc.nasa.gov

## License

MIT
