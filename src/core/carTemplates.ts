import type { CarProfile } from './types';

/**
 * Builds a CarProfile from a handful of user-entered measurements, for any
 * car not in the curated library (a rare trim, an older or discontinued
 * model, an import). Applies the same non-box modeling patterns used for
 * the curated cars — a wheel-arch pinch, a sloped-liftgate height cut, or a
 * sedan's hinge-corner reduction — instead of treating the input as one
 * plain box, using fixed proportions rather than exact measured regions.
 * It's necessarily rougher than a researched entry, which is exactly why
 * the resulting profile is flagged `isCustom` and shown as an estimate.
 */
export interface GenericCarInput {
  id: string;
  make: string;
  model: string;
  years?: string;
  bodyStyle: CarProfile['bodyStyle'];
  /** Overall usable cargo width/depth/height in cm — the biggest a rigid
   * item could be and still (mostly) fit, roughly measured or looked up. */
  width: number;
  depth: number;
  height: number;
  openingWidth?: number;
  openingHeight?: number;
  /** SUV/pickup: rear wheel housings visibly narrow the load floor. */
  hasWheelArchPinch?: boolean;
  /** Hatchback/wagon/SUV/minivan: the liftgate glass or roofline slopes
   * down toward the opening. */
  hasSlopedOpening?: boolean;
}

export function buildGenericCarProfile(input: GenericCarInput): CarProfile {
  const { width: w, depth: d, height: h, bodyStyle } = input;
  const openingWidth = input.openingWidth ?? w;
  const openingHeight = input.openingHeight ?? (bodyStyle === 'sedan' || bodyStyle === 'coupe' ? h * 0.85 : h);

  const base: Omit<CarProfile, 'trunkRegions' | 'opening'> = {
    id: input.id,
    make: input.make,
    model: input.model,
    years: input.years ?? 'unknown year',
    bodyStyle,
    isCustom: true,
    notes: ['Estimated from your own measurements — treat spacing near the edges as approximate.'],
    sourceNote: 'Generated from user-entered overall dimensions using a generic body-style template, not a measured cavity.',
  };

  const opening = { width: openingWidth, height: openingHeight, lipHeight: bodyStyle === 'pickup' ? h * 1.7 : 6 };

  if (bodyStyle === 'sedan' || bodyStyle === 'coupe') {
    return {
      ...base,
      opening,
      trunkRegions: [
        { label: 'main floor', xMin: 0, xMax: w, yMin: 0, yMax: d, zMin: 0, zMax: h * 0.7 },
        { label: 'center (full height)', xMin: w * 0.12, xMax: w * 0.88, yMin: d * 0.1, yMax: d * 0.9, zMin: h * 0.7, zMax: h },
      ],
      notes: [...base.notes!, 'Trunk-lid hinges typically dip into the rear top corners on this body style.', 'Enclosed trunk: packing it never blocks your rear-view mirror.'],
    };
  }

  if (bodyStyle === 'hatchback' || bodyStyle === 'wagon') {
    const sloped = input.hasSlopedOpening ?? true;
    const nearHeight = sloped ? h * 0.65 : h;
    return {
      ...base,
      opening,
      trunkRegions: [
        { label: 'near opening', xMin: 0, xMax: w, yMin: 0, yMax: d * 0.25, zMin: 0, zMax: nearHeight },
        { label: 'deep zone', xMin: 0, xMax: w, yMin: d * 0.25, yMax: d, zMin: 0, zMax: h },
      ],
      seatsFoldedExtraRegions: [{ label: 'extended floor (seats folded)', xMin: 0, xMax: w, yMin: d, yMax: d * 2.1, zMin: 0, zMax: h * 0.9 }],
      rearVisibility: { points: [{ y: 0, z: h * 0.85 }, { y: d * 0.5, z: h * 0.55 }, { y: d, z: h * 0.35 }] },
      notes: sloped ? [...base.notes!, 'Sloped liftgate/roofline assumed — full height is only available deeper past the opening.'] : base.notes,
    };
  }

  if (bodyStyle === 'suv' || bodyStyle === 'minivan') {
    const pinch = input.hasWheelArchPinch ?? bodyStyle === 'suv';
    if (!pinch) {
      return {
        ...base,
        opening,
        trunkRegions: [
          { label: 'main floor', xMin: 0, xMax: w, yMin: 0, yMax: d, zMin: 0, zMax: h * 0.8 },
          { label: 'center (full height)', xMin: w * 0.1, xMax: w * 0.9, yMin: d * 0.05, yMax: d * 0.95, zMin: h * 0.8, zMax: h },
        ],
        seatsFoldedExtraRegions: [{ label: 'extended floor (seats folded)', xMin: 0, xMax: w, yMin: d, yMax: d * 2, zMin: 0, zMax: h }],
        rearVisibility: { points: [{ y: 0, z: h * 0.9 }, { y: d * 0.5, z: h * 0.55 }, { y: d, z: h * 0.35 }] },
      };
    }
    return {
      ...base,
      opening,
      trunkRegions: [
        { label: 'floor (below wheel arches)', xMin: 0, xMax: w, yMin: 0, yMax: d, zMin: 0, zMax: h * 0.22 },
        { label: 'mid zone (narrowed by wheel arches)', xMin: w * 0.16, xMax: w * 0.84, yMin: 0, yMax: d, zMin: h * 0.22, zMax: h * 0.6 },
        { label: 'upper zone (full width)', xMin: 0, xMax: w, yMin: 0, yMax: d, zMin: h * 0.6, zMax: h },
      ],
      seatsFoldedExtraRegions: [{ label: 'extended floor (seats folded)', xMin: 0, xMax: w, yMin: d, yMax: d * 1.85, zMin: 0, zMax: h }],
      rearVisibility: { points: [{ y: 0, z: h * 0.85 }, { y: d * 0.5, z: h * 0.55 }, { y: d, z: h * 0.35 }] },
      notes: [...base.notes!, 'Rear wheel arches assumed to bulge into the load floor at low-to-mid height.'],
    };
  }

  // pickup
  const tubWidth = w * 0.12;
  return {
    ...base,
    opening: { ...opening, width: w, height: h },
    trunkRegions: [
      { label: 'bed floor (between wheel tubs)', xMin: tubWidth, xMax: w - tubWidth, yMin: 0, yMax: d, zMin: 0, zMax: h },
      { label: 'left wheel-tub shelf', xMin: 0, xMax: tubWidth, yMin: 0, yMax: d, zMin: h * 0.65, zMax: h },
      { label: 'right wheel-tub shelf', xMin: w - tubWidth, xMax: w, yMin: 0, yMax: d, zMin: h * 0.65, zMax: h },
    ],
    notes: [...base.notes!, 'Open bed assumed — no lid to close, but stay under the side-rail height or use tie-downs for anything stacked taller.', 'No rear window over an open bed.'],
  };
}
