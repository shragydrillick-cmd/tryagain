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
  {
    id: 'tesla-model-3',
    make: 'Tesla',
    model: 'Model 3',
    years: '2024–2026',
    bodyStyle: 'sedan',
    opening: { width: 94, height: 46, lipHeight: 5 },
    trunkRegions: [
      { label: 'sub-trunk (under the floor panel)', xMin: 16.5, xMax: 77.5, yMin: 0, yMax: 46, zMin: -30, zMax: 0 },
      { label: 'near opening', xMin: 0, xMax: 94, yMin: 0, yMax: 40, zMin: 0, zMax: 46 },
      { label: 'deep zone (taller)', xMin: 0, xMax: 94, yMin: 40, yMax: 107, zMin: 0, zMax: 58 },
    ],
    seatsFoldedExtraRegions: [{ label: 'extended floor (seats folded)', xMin: 0, xMax: 94, yMin: 107, yMax: 187, zMin: 0, zMax: 58 }],
    notes: [
      'There\'s also a front trunk ("frunk") — about 3.1 cu ft, roughly a small carry-on\'s worth — not modeled here since it\'s a separate compartment; use it as bonus space for small squishy items.',
      'A lower "sub-trunk" sits under a removable floor panel — great for flat items you won\'t need until you unpack.',
      'Enclosed trunk: packing it never blocks your rear-view mirror.',
    ],
    sourceNote: 'Derived from published Model 3 Highland trunk depth/width/opening-height and frunk/sub-trunk figures.',
  },
  {
    id: 'subaru-outback-wagon',
    make: 'Subaru',
    model: 'Outback',
    years: '2021–2025',
    bodyStyle: 'wagon',
    opening: { width: 109.2, height: 73.7, lipHeight: 6 },
    trunkRegions: [
      { label: 'near liftgate (sloped glass overhead)', xMin: 0, xMax: 111.8, yMin: 0, yMax: 20, zMin: 0, zMax: 60 },
      { label: 'deep zone (full height)', xMin: 0, xMax: 111.8, yMin: 20, yMax: 88.9, zMin: 0, zMax: 76.2 },
    ],
    seatsFoldedExtraRegions: [{ label: 'extended floor (seats folded)', xMin: 0, xMax: 111.8, yMin: 88.9, yMax: 190.5, zMin: 0, zMax: 76.2 }],
    rearVisibility: {
      points: [
        { y: 0, z: 66 },
        { y: 44, z: 42 },
        { y: 89, z: 26 },
      ],
    },
    notes: ['Barely narrows at the wheel housings — close to full width the whole way back, unlike a typical SUV.'],
    sourceNote: 'Derived from published ~32.6 cu ft cargo volume behind rear seats and 43×29 in liftgate opening.',
  },
  {
    id: 'jeep-wrangler-unlimited',
    make: 'Jeep',
    model: 'Wrangler Unlimited (4-door)',
    years: '2018–2025',
    bodyStyle: 'suv',
    opening: { width: 105.4, height: 90.8, lipHeight: 15 },
    trunkRegions: [
      { label: 'main floor', xMin: 0, xMax: 102.2, yMin: 0, yMax: 81.3, zMin: 0, zMax: 70 },
      { label: 'center (full height)', xMin: 15, xMax: 87.2, yMin: 10, yMax: 71.3, zMin: 70, zMax: 90.8 },
    ],
    rearVisibility: {
      points: [
        { y: 0, z: 80 },
        { y: 40, z: 55 },
        { y: 81, z: 35 },
      ],
    },
    notes: [
      'Side-hinged tailgate, not a lifting lid — height stays fairly constant front-to-back with no slope to work around.',
      'Exposed roll bar and tailgate hinges pinch the very top corners.',
    ],
    sourceNote: 'Derived from published ~31.7 cu ft cargo volume behind rear seats and forum-measured opening (41.5×35.75 in).',
  },
  {
    id: 'vw-new-beetle-hatchback',
    make: 'Volkswagen',
    model: 'New Beetle',
    years: '2003–2010',
    bodyStyle: 'hatchback',
    opening: { width: 95, height: 40, lipHeight: 8 },
    trunkRegions: [
      { label: 'near liftgate (bubble-shaped glass curves down fast)', xMin: 0, xMax: 100, yMin: 0, yMax: 20, zMin: 0, zMax: 30 },
      { label: 'deep zone', xMin: 0, xMax: 100, yMin: 20, yMax: 65, zMin: 0, zMax: 52 },
    ],
    seatsFoldedExtraRegions: [{ label: 'extended floor (seats folded)', xMin: 0, xMax: 100, yMin: 65, yMax: 145, zMin: 0, zMax: 48 }],
    rearVisibility: {
      points: [
        { y: 0, z: 42 },
        { y: 45, z: 24 },
      ],
    },
    notes: ['The iconic sloped hatch glass curves down quickly — very little height right at the opening.'],
    sourceNote:
      'Discontinued model — estimated from published ~12 cu ft (seats up) / ~27 cu ft (seats folded) cargo volume only; no detailed cavity measurements are published for it. A good example of when "add a car we don\'t have" with your own tape-measure numbers beats a guess.',
  },
  {
    id: 'ford-mustang-coupe',
    make: 'Ford',
    model: 'Mustang (Fastback)',
    years: '2015–2024',
    bodyStyle: 'coupe',
    opening: { width: 61, height: 30.5, lipHeight: 10 },
    trunkRegions: [
      { label: 'near opening (tapered by the fastback roofline)', xMin: 0, xMax: 61, yMin: 0, yMax: 20, zMin: 0, zMax: 30.5 },
      { label: 'wider zone', xMin: 0, xMax: 106.7, yMin: 20, yMax: 91.4, zMin: 0, zMax: 40.6 },
    ],
    notes: [
      'Small, low, tapered trunk opening typical of a sports coupe — long or tall items may not fit even if the interior has some room.',
      'Enclosed trunk: packing it never blocks your rear-view mirror.',
    ],
    sourceNote: 'Estimated from published ~13.5 cu ft trunk volume and forum-reported opening measurements; treat as approximate.',
  },
  {
    id: 'ford-taurus-sedan',
    make: 'Ford',
    model: 'Taurus',
    years: '2013–2019',
    bodyStyle: 'sedan',
    opening: { width: 118, height: 42, lipHeight: 5 },
    trunkRegions: [
      { label: 'main floor', xMin: 0, xMax: 118, yMin: 0, yMax: 96, zMin: 0, zMax: 40 },
      { label: 'center (full height)', xMin: 15, xMax: 103, yMin: 10, yMax: 86, zMin: 40, zMax: 50 },
    ],
    notes: [
      'Ford discontinued the Taurus after the 2019 model year — dimensions are estimated from the published trunk volume since no detailed cavity spec survives online; "add a car we don\'t have" with a tape measure will beat this if you can.',
      'Enclosed trunk: packing it never blocks your rear-view mirror.',
    ],
    sourceNote: 'Estimated from published 20.1 cu ft trunk volume, scaled from typical large-sedan trunk-lid geometry.',
  },
  {
    id: 'nissan-rogue-suv',
    make: 'Nissan',
    model: 'Rogue',
    years: '2021–2024',
    bodyStyle: 'suv',
    opening: { width: 106.7, height: 71.1, lipHeight: 8 },
    trunkRegions: [
      { label: 'floor (below wheel arches)', xMin: 0, xMax: 106.7, yMin: 0, yMax: 101.6, zMin: 0, zMax: 20 },
      { label: 'mid zone (narrowed by wheel arches)', xMin: 18, xMax: 88.7, yMin: 0, yMax: 101.6, zMin: 20, zMax: 55 },
      { label: 'upper zone (full width)', xMin: 0, xMax: 106.7, yMin: 0, yMax: 101.6, zMin: 55, zMax: 95 },
    ],
    seatsFoldedExtraRegions: [{ label: 'extended floor (seats folded)', xMin: 0, xMax: 106.7, yMin: 101.6, yMax: 178, zMin: 0, zMax: 95 }],
    rearVisibility: {
      points: [
        { y: 0, z: 82 },
        { y: 50, z: 52 },
        { y: 102, z: 32 },
      ],
    },
    notes: ['Rear wheel arches bulge into the load floor at low-to-mid height — full width returns higher up.'],
    sourceNote: 'Derived from published ~36.5 cu ft cargo volume behind rear seats and 42×28 in liftgate opening.',
  },
  {
    id: 'bmw-3-series-sedan',
    make: 'BMW',
    model: '3 Series',
    years: '2019–2025',
    bodyStyle: 'sedan',
    opening: { width: 114, height: 44, lipHeight: 5 },
    trunkRegions: [
      { label: 'main floor', xMin: 0, xMax: 114, yMin: 0, yMax: 90, zMin: 0, zMax: 36 },
      { label: 'center (full height)', xMin: 15, xMax: 99, yMin: 10, yMax: 80, zMin: 36, zMax: 47 },
    ],
    notes: ['Trunk-lid hinges dip into the rear top corners.', 'Enclosed trunk: packing it never blocks your rear-view mirror.'],
    sourceNote: 'Estimated from published ~17.0 cu ft trunk volume, scaled from typical compact-luxury-sedan trunk-lid geometry.',
  },
];

export function getCarById(id: string): CarProfile | undefined {
  return CARS.find((c) => c.id === id);
}

/** Looks up a car by id in the curated library first, then in a supplied
 * list of user-added custom cars (session or saved). */
export function resolveCar(id: string, customCars: CarProfile[] = []): CarProfile | undefined {
  return getCarById(id) ?? customCars.find((c) => c.id === id);
}
