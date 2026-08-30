/**
 * Domain model for the packing engine.
 *
 * Coordinate system (all units cm, all cars/items normalized to this frame):
 *   x — left/right across the trunk, 0 at the left wall
 *   y — depth, 0 at the trunk opening (bumper/liftgate lip), increasing toward
 *       the front of the cargo area (toward the back seats)
 *   z — height, 0 at the cargo floor, increasing upward
 *
 * A `zMax` on a cavity region is the height still allowed with the trunk lid
 * or liftgate CLOSED at that footprint location — not the open-lid volume.
 * That's what lets the engine reason about "will it actually close" instead
 * of just comparing to a single box-volume number.
 */

/** An axis-aligned cuboid sub-region of the cargo cavity. A trunk's usable
 * space is the union of its regions, so shapes that aren't a single box
 * (wheel-well cutouts, a stepped liftgate slope, a shorter zone right at the
 * bumper lip before the hinge arc clears) are built from several regions. */
export interface CavityRegion {
  label: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  /** Max closed-lid height at this footprint. */
  zMax: number;
}

/** Optional overlay describing the height beyond which stacked cargo starts
 * blocking the driver's rear view, at a given depth `y`. Only enforced when
 * the user asks to preserve rear visibility. */
export interface RearVisibilityProfile {
  /** Piecewise points (y, maxZ) sorted by y ascending; interpolated linearly. */
  points: { y: number; z: number }[];
}

export interface TrunkOpening {
  width: number;
  height: number;
  /** Height of the bumper/load lip cargo must clear on the way in, informing
   * "load this while it's still easy to lift over the edge" ordering. */
  lipHeight: number;
}

export interface CarProfile {
  id: string;
  make: string;
  model: string;
  years: string;
  bodyStyle: 'sedan' | 'hatchback' | 'suv' | 'minivan' | 'pickup' | 'wagon';
  trunkRegions: CavityRegion[];
  opening: TrunkOpening;
  rearVisibility?: RearVisibilityProfile;
  /** Folding a rear seat row extends usable depth; recorded as extra regions
   * appended when the user says seats are folded. */
  seatsFoldedExtraRegions?: CavityRegion[];
  notes?: string[];
  sourceNote?: string;
}

export type ItemShape =
  | { kind: 'box'; w: number; d: number; h: number }
  /** Sub-boxes relative to the item's own local origin (its own min corner at 0,0,0).
   * Used for items that aren't a simple box, e.g. a stroller = wheel-base box
   * plus an offset folded-frame box. */
  | { kind: 'compound'; boxes: { dx: number; dy: number; dz: number; w: number; d: number; h: number }[] };

export interface ItemDef {
  id: string;
  name: string;
  category: string;
  shape: ItemShape;
  weightKg?: number;
  /** False = soft-sided/compressible (duffel, backpack, beanbag-ish cooler bag). */
  rigid: boolean;
  /** 0-1 fraction of volume that can be squeezed out when it's the last piece
   * filling a gap (soft bags only). */
  compressibility?: number;
  canStandOnEnd: boolean;
  /** Can be angled a few degrees to slip under a sloped liftgate/lid line. */
  canTiltForClosing: boolean;
  orientationsAllowed: 'any' | 'uprightOnly' | 'flatOnly';
  fragile?: boolean;
  icon?: string;
  sourceNote?: string;
}

export interface PackItemRequest {
  itemId: string;
  qty: number;
  /** For ad-hoc custom items not in the shared library. */
  customItem?: ItemDef;
}

export interface PackRequest {
  carId: string;
  seatsFolded?: boolean;
  items: PackItemRequest[];
  /** Item ids the passenger wants to grab without unpacking everything else. */
  accessibleItemIds?: string[];
  keepRearVisibility?: boolean;
  allowBlockingRearView?: 'auto' | 'never' | 'ifNeeded';
}

export interface PlacedItem {
  order: number;
  instanceId: string;
  itemId: string;
  itemName: string;
  category: string;
  /** Min-corner position in trunk frame. */
  position: { x: number; y: number; z: number };
  /** Actual placed footprint/height after any rotation (w along x, d along y, h along z). */
  size: { w: number; d: number; h: number };
  rotated: boolean;
  standingOnEnd: boolean;
  accessible: boolean;
  regionLabel: string;
  note?: string;
}

export interface UnplacedItem {
  itemId: string;
  itemName: string;
  instanceIndex: number;
  reason: string;
}

export interface PackWarning {
  code: 'rear-visibility-blocked' | 'item-buried-despite-accessible-request' | 'trunk-nearly-full' | 'seats-recommended';
  message: string;
}

export interface PackPlan {
  carId: string;
  placements: PlacedItem[];
  unplaced: UnplacedItem[];
  warnings: PackWarning[];
  cavityVolumeCm3: number;
  usedVolumeCm3: number;
  fillRatio: number;
  rearBlocked: boolean;
}
