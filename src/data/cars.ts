import type { CarProfile } from '../core/types';

/**
 * Seed car database. Trunk/cargo-area region breakdowns are engineering
 * approximations built from published cargo-volume, opening, and body-style
 * specs (not an official manufacturer CAD export) — good enough to reason
 * about "will it fit and will it close," but exact shape varies by trim,
 * options (subwoofer boxes, spare-tire deletes, etc.) and model year.
 * `sourceNote` on each car says what the approximation is based on.
 *
 * Sedans keep the trunk mechanically separate from the cabin, so packing
 * one never affects the driver's rear-window view — `rearVisibility` is
 * only defined for body styles where the cargo area sits open to the back
 * glass (hatchback / SUV / minivan).
 */
export const CARS: CarProfile[] = [
  {
    id: 'toyota-camry-sedan',
    make: 'Toyota',
    model: 'Camry',
    years: '2018–2024',
    bodyStyle: 'sedan',
    opening: { width: 112, height: 46, lipHeight: 5 },
    trunkRegions: [
      { label: 'main floor', xMin: 0, xMax: 112, yMin: 0, yMax: 89, zMin: 0, zMax: 38 },
      { label: 'center (full height)', xMin: 14, xMax: 98, yMin: 10, yMax: 80, zMin: 38, zMax: 53 },
    ],
    notes: [
      'Trunk-lid hinges dip into the rear top corners — keep tall items out of the far left/right near the lid.',
      'Enclosed trunk: packing it never blocks your rear-view mirror.',
    ],
    sourceNote: 'Derived from published 15.1 cu ft trunk volume and typical sedan trunk-lid geometry.',
  },
  {
    id: 'honda-civic-sedan',
    make: 'Honda',
    model: 'Civic Sedan',
    years: '2022–2024',
    bodyStyle: 'sedan',
    opening: { width: 102, height: 41, lipHeight: 5 },
    trunkRegions: [
      { label: 'main floor', xMin: 0, xMax: 102, yMin: 0, yMax: 86, zMin: 0, zMax: 32 },
      { label: 'center (full height)', xMin: 10, xMax: 92, yMin: 8, yMax: 76, zMin: 32, zMax: 46 },
    ],
    notes: ['Compact sedan trunk — expect a snugger fit than a midsize.', 'Enclosed trunk: packing it never blocks your rear-view mirror.'],
    sourceNote: 'Derived from published ~14.4 cu ft trunk volume and typical compact-sedan trunk geometry.',
  },
  {
    id: 'toyota-corolla-hatchback',
    make: 'Toyota',
    model: 'Corolla Hatchback',
    years: '2019–2024',
    bodyStyle: 'hatchback',
    opening: { width: 102, height: 61, lipHeight: 8 },
    trunkRegions: [
      { label: 'near liftgate (sloped glass overhead)', xMin: 0, xMax: 102, yMin: 0, yMax: 25, zMin: 0, zMax: 41 },
      { label: 'deep zone (full height)', xMin: 0, xMax: 102, yMin: 25, yMax: 61, zMin: 0, zMax: 61 },
    ],
    seatsFoldedExtraRegions: [{ label: 'extended floor (seats folded)', xMin: 0, xMax: 102, yMin: 61, yMax: 135, zMin: 0, zMax: 55 }],
    rearVisibility: {
      points: [
        { y: 0, z: 55 },
        { y: 35, z: 34 },
        { y: 61, z: 20 },
      ],
    },
    notes: ['Liftgate glass slopes down toward the opening — full height is only available once you\'re past the first ~25 cm.'],
    sourceNote: 'Derived from published ~17.8 cu ft cargo volume and typical hatchback liftgate geometry.',
  },
  {
    id: 'honda-crv-suv',
    make: 'Honda',
    model: 'CR-V',
    years: '2023–2024',
    bodyStyle: 'suv',
    opening: { width: 112, height: 74, lipHeight: 8 },
    trunkRegions: [
      { label: 'floor (below wheel arches)', xMin: 0, xMax: 112, yMin: 0, yMax: 99, zMin: 0, zMax: 18 },
      { label: 'mid zone (narrowed by wheel arches)', xMin: 18, xMax: 94, yMin: 0, yMax: 99, zMin: 18, zMax: 50 },
      { label: 'upper zone (full width)', xMin: 0, xMax: 112, yMin: 0, yMax: 99, zMin: 50, zMax: 81 },
    ],
    seatsFoldedExtraRegions: [{ label: 'extended floor (seats folded)', xMin: 0, xMax: 112, yMin: 99, yMax: 183, zMin: 0, zMax: 81 }],
    rearVisibility: {
      points: [
        { y: 0, z: 70 },
        { y: 50, z: 45 },
        { y: 99, z: 28 },
      ],
    },
    notes: ['Rear wheel arches bulge into the load floor at low-to-mid height — full width returns higher up.'],
    sourceNote: 'Derived from published liftgate opening (44×29 in) and ~39.3 cu ft cargo volume behind the rear seats.',
  },
  {
    id: 'honda-odyssey-minivan',
    make: 'Honda',
    model: 'Odyssey',
    years: '2021–2024',
    bodyStyle: 'minivan',
    opening: { width: 122, height: 91, lipHeight: 3 },
    trunkRegions: [
      { label: 'main floor (behind 3rd row)', xMin: 0, xMax: 107, yMin: 0, yMax: 102, zMin: 0, zMax: 70 },
      { label: 'center (full height)', xMin: 10, xMax: 97, yMin: 5, yMax: 95, zMin: 70, zMax: 91 },
    ],
    seatsFoldedExtraRegions: [{ label: 'extended floor (3rd row folded)', xMin: 0, xMax: 107, yMin: 102, yMax: 230, zMin: 0, zMax: 91 }],
    rearVisibility: {
      points: [
        { y: 0, z: 82 },
        { y: 60, z: 55 },
        { y: 102, z: 40 },
      ],
    },
    notes: ['Low, flat load floor — the easiest of this list to lift heavy items into.'],
    sourceNote: 'Derived from published 32.8–38.6 cu ft cargo volume behind the 3rd row.',
  },
  {
    id: 'ford-f150-pickup-5-5ft',
    make: 'Ford',
    model: 'F-150 (5.5 ft bed)',
    years: '2021–2024',
    bodyStyle: 'pickup',
    opening: { width: 165, height: 50, lipHeight: 86 },
    trunkRegions: [
      { label: 'bed floor (between wheel tubs)', xMin: 19, xMax: 146, yMin: 0, yMax: 168, zMin: 0, zMax: 50 },
      { label: 'left wheel-tub shelf', xMin: 0, xMax: 19, yMin: 0, yMax: 168, zMin: 35, zMax: 50 },
      { label: 'right wheel-tub shelf', xMin: 146, xMax: 165, yMin: 0, yMax: 168, zMin: 35, zMax: 50 },
    ],
    notes: [
      'Open bed — there\'s no lid to close, but stay under the ~50 cm side-rail height (or use a cargo net / tie-downs) for anything you stack taller.',
      'Wheel tubs narrow the floor by about 19 cm on each side.',
      'No rear window over an open bed, so there\'s nothing to block.',
    ],
    sourceNote: 'Derived from typical 5.5 ft box specs: ~65 in outer width, ~50 in between wheel tubs, ~67 in bed length.',
  },
];

export function getCarById(id: string): CarProfile | undefined {
  return CARS.find((c) => c.id === id);
}
