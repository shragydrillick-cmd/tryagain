import type { CavityRegion, ItemShape } from './types';

export interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

const EPS = 1e-6;

export function regionVolume(r: CavityRegion): number {
  return Math.max(0, r.xMax - r.xMin) * Math.max(0, r.yMax - r.yMin) * Math.max(0, r.zMax - r.zMin);
}

export function totalCavityVolume(regions: CavityRegion[]): number {
  return regions.reduce((sum, r) => sum + regionVolume(r), 0);
}

export function boxVolume(w: number, d: number, h: number): number {
  return w * d * h;
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w - EPS &&
    a.x + a.w > b.x + EPS &&
    a.y < b.y + b.d - EPS &&
    a.y + a.d > b.y + EPS &&
    a.z < b.z + b.h - EPS &&
    a.z + a.h > b.z + EPS
  );
}

/** Merged z-intervals of every region whose xy footprint contains the point. */
function zIntervalsAtPoint(regions: CavityRegion[], x: number, y: number): [number, number][] {
  const hits = regions.filter((r) => x >= r.xMin - EPS && x <= r.xMax + EPS && y >= r.yMin - EPS && y <= r.yMax + EPS);
  if (hits.length === 0) return [];
  const intervals = hits.map((r): [number, number] => [r.zMin, r.zMax]).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [lo, hi] of intervals) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1] + EPS) {
      last[1] = Math.max(last[1], hi);
    } else {
      merged.push([lo, hi]);
    }
  }
  return merged;
}

/** Max closed-lid height available at a footprint point, capped by an optional
 * overlay (e.g. rear-visibility sightline). */
export function maxHeightAt(regions: CavityRegion[], x: number, y: number, cap?: (y: number) => number): number {
  const intervals = zIntervalsAtPoint(regions, x, y);
  if (intervals.length === 0) return 0;
  // Assume cargo sits on the floor (lowest interval's min); usable ceiling is
  // that interval's top unless a higher disjoint interval exists (rare, e.g.
  // shelf above a well) - for a floor-loaded item we only care about the
  // interval that starts at/near the lowest zMin.
  const floorInterval = intervals[0];
  let ceiling = floorInterval[1];
  if (cap) ceiling = Math.min(ceiling, cap(y));
  return Math.max(0, ceiling);
}

/** Whether the cuboid [x,x+w) x [y,y+d) x [z,z+h) is fully contained within
 * the union of cavity regions (respecting closed-lid height at every sampled
 * footprint column), using a grid sample since regions may be an irregular
 * union (wheel wells, stepped slopes). */
export function boxFitsInCavity(
  box: Box,
  regions: CavityRegion[],
  opts: { sampleStep?: number; heightCap?: (y: number) => number } = {}
): boolean {
  const step = opts.sampleStep ?? 5;
  const xs = sampleRange(box.x, box.x + box.w, step);
  const ys = sampleRange(box.y, box.y + box.d, step);
  for (const x of xs) {
    for (const y of ys) {
      const h = maxHeightAt(regions, x, y, opts.heightCap);
      // Need the column to support cargo from the trunk floor up through box.z + box.h.
      const intervals = zIntervalsAtPoint(regions, x, y);
      if (intervals.length === 0) return false;
      const floor = intervals[0][0];
      if (box.z < floor - EPS) return false;
      if (box.z + box.h > h + EPS) return false;
    }
  }
  return true;
}

function sampleRange(min: number, max: number, step: number): number[] {
  if (max <= min) return [min];
  const pts = [min];
  let v = min + step;
  while (v < max - EPS) {
    pts.push(v);
    v += step;
  }
  pts.push(max - EPS > min ? max : min);
  return Array.from(new Set(pts.map((p) => Math.round(p * 1000) / 1000)));
}

export function regionLabelAt(regions: CavityRegion[], x: number, y: number): string {
  const hit = regions.find((r) => x >= r.xMin - EPS && x <= r.xMax + EPS && y >= r.yMin - EPS && y <= r.yMax + EPS);
  return hit?.label ?? 'trunk';
}

export interface Orientation {
  w: number;
  d: number;
  h: number;
  standingOnEnd: boolean;
}

/** Generates candidate axis-aligned orientations for a box shape. */
export function generateOrientations(
  shape: Extract<ItemShape, { kind: 'box' }>,
  canStandOnEnd: boolean,
  orientationsAllowed: 'any' | 'uprightOnly' | 'flatOnly'
): Orientation[] {
  const { w, d, h } = shape;
  const verticalChoices: { w: number; d: number; h: number; standingOnEnd: boolean }[] =
    orientationsAllowed === 'any' && canStandOnEnd
      ? [
          { w, d, h, standingOnEnd: false },
          { w: h, d, h: w, standingOnEnd: true },
          { w, d: h, h: d, standingOnEnd: true },
        ]
      : [{ w, d, h, standingOnEnd: false }];

  const out: Orientation[] = [];
  for (const v of verticalChoices) {
    out.push({ w: v.w, d: v.d, h: v.h, standingOnEnd: v.standingOnEnd });
    if (v.w !== v.d) out.push({ w: v.d, d: v.w, h: v.h, standingOnEnd: v.standingOnEnd });
  }
  return out;
}

/** World-space box for a box-shaped item placed at an origin with a given orientation. */
export function worldBoxForOrientation(origin: { x: number; y: number; z: number }, orientation: Orientation): Box {
  return { x: origin.x, y: origin.y, z: origin.z, w: orientation.w, d: orientation.d, h: orientation.h };
}

export type CompoundSubBox = Extract<ItemShape, { kind: 'compound' }>['boxes'][number];

export interface CompoundOrientation {
  boxes: CompoundSubBox[];
  standingOnEnd: boolean;
}

/** Rigidly re-labels two axes of every sub-box in a compound assembly —
 * equivalent to a 90-degree rotation of the whole assembly about the third
 * axis. Each axis's sub-box offsets already start at 0 (by construction of
 * the authored shape), so swapping two axes' (offset, extent) pairs stays a
 * valid, still-normalized assembly with no renormalization needed. */
function swapCompoundAxes(boxes: CompoundSubBox[], axes: 'xz' | 'yz' | 'xy'): CompoundSubBox[] {
  return boxes.map((b) => {
    if (axes === 'xz') return { dx: b.dz, dy: b.dy, dz: b.dx, w: b.h, d: b.d, h: b.w };
    if (axes === 'yz') return { dx: b.dx, dy: b.dz, dz: b.dy, w: b.w, d: b.h, h: b.d };
    return { dx: b.dy, dy: b.dx, dz: b.dz, w: b.d, d: b.w, h: b.h };
  });
}

/** Generates candidate orientations for a compound (multi-box) shape — the
 * same "which axis is vertical, plus yaw" degrees of freedom as a plain box
 * (see generateOrientations), applied to the whole assembly at once so a
 * compound item (a stroller, a suitcase modeled with protruding wheels) can
 * be stood on end just like a simple box can, not just rotated flat. */
export function generateCompoundOrientations(
  boxes: CompoundSubBox[],
  canStandOnEnd: boolean,
  orientationsAllowed: 'any' | 'uprightOnly' | 'flatOnly'
): CompoundOrientation[] {
  const verticalVariants: CompoundOrientation[] =
    orientationsAllowed === 'any' && canStandOnEnd
      ? [
          { boxes, standingOnEnd: false },
          { boxes: swapCompoundAxes(boxes, 'xz'), standingOnEnd: true },
          { boxes: swapCompoundAxes(boxes, 'yz'), standingOnEnd: true },
        ]
      : [{ boxes, standingOnEnd: false }];

  const out: CompoundOrientation[] = [];
  for (const v of verticalVariants) {
    out.push(v);
    out.push({ boxes: swapCompoundAxes(v.boxes, 'xy'), standingOnEnd: v.standingOnEnd });
  }
  return out;
}

export function worldBoxesForCompound(origin: { x: number; y: number; z: number }, boxes: CompoundSubBox[]): Box[] {
  return boxes.map((b) => ({ x: origin.x + b.dx, y: origin.y + b.dy, z: origin.z + b.dz, w: b.w, d: b.d, h: b.h }));
}

export function boundingBoxOf(boxes: Box[]): Box {
  const xMin = Math.min(...boxes.map((b) => b.x));
  const yMin = Math.min(...boxes.map((b) => b.y));
  const zMin = Math.min(...boxes.map((b) => b.z));
  const xMax = Math.max(...boxes.map((b) => b.x + b.w));
  const yMax = Math.max(...boxes.map((b) => b.y + b.d));
  const zMax = Math.max(...boxes.map((b) => b.z + b.h));
  return { x: xMin, y: yMin, z: zMin, w: xMax - xMin, d: yMax - yMin, h: zMax - zMin };
}
