import type {
  CarProfile,
  ItemDef,
  PackItemRequest,
  PackPlan,
  PackRequest,
  PackWarning,
  PlacedItem,
  UnplacedItem,
} from './types';
import {
  boundingBoxOf,
  boxesOverlap,
  boxFitsInCavity,
  boxVolume,
  generateOrientations,
  regionLabelAt,
  totalCavityVolume,
  worldBoxesFor,
  type Box,
  type Orientation,
} from './geometry';

interface ItemInstance {
  instanceId: string;
  def: ItemDef;
  accessible: boolean;
}

function expandInstances(items: PackItemRequest[], byId: Map<string, ItemDef>, accessibleIds: Set<string>): ItemInstance[] {
  const out: ItemInstance[] = [];
  for (const req of items) {
    const def = req.customItem ?? byId.get(req.itemId);
    if (!def) continue;
    for (let i = 0; i < req.qty; i++) {
      out.push({ instanceId: `${def.id}#${i + 1}`, def, accessible: accessibleIds.has(def.id) });
    }
  }
  return out;
}

function itemVolume(def: ItemDef): number {
  if (def.shape.kind === 'box') return boxVolume(def.shape.w, def.shape.d, def.shape.h);
  return def.shape.boxes.reduce((s, b) => s + boxVolume(b.w, b.d, b.h), 0);
}

/** Rough footprint bounding box (unrotated) for a shape, used for the trunk-opening check. */
function shapeFootprint(def: ItemDef): { w: number; d: number; h: number } {
  if (def.shape.kind === 'box') return def.shape;
  const bb = boundingBoxOf(def.shape.boxes.map((b) => ({ x: b.dx, y: b.dy, z: b.dz, w: b.w, d: b.d, h: b.h })));
  return { w: bb.w, d: bb.d, h: bb.h };
}

function fitsThroughOpening(w: number, h: number, opening: CarProfile['opening'], canTilt: boolean): boolean {
  const tol = canTilt ? 1.15 : 1.0;
  return w <= opening.width * tol && h <= opening.height * tol;
}

/** Candidate x/y grid derived from region edges and already-placed item edges. */
function candidateAxis(edges: number[], min: number, max: number): number[] {
  const set = new Set<number>([min]);
  for (const e of edges) if (e >= min && e <= max) set.add(e);
  return Array.from(set).sort((a, b) => a - b);
}

function regionBounds(regions: CarProfile['trunkRegions']) {
  return {
    xMin: Math.min(...regions.map((r) => r.xMin)),
    xMax: Math.max(...regions.map((r) => r.xMax)),
    yMin: Math.min(...regions.map((r) => r.yMin)),
    yMax: Math.max(...regions.map((r) => r.yMax)),
  };
}

interface PlacementResult {
  origin: { x: number; y: number; z: number };
  orientation: Orientation;
  yawSwapped: boolean;
  worldBoxes: Box[];
}

function tryPlace(
  def: ItemDef,
  regions: CarProfile['trunkRegions'],
  placed: { worldBoxes: Box[] }[],
  heightCap: ((y: number) => number) | undefined,
  scale = 1
): PlacementResult | null {
  const bounds = regionBounds(regions);
  // Seed candidates from both already-placed item edges AND every cavity
  // region's own boundaries — region boundaries are where the available
  // height changes (a wheel-arch pinch, a slope step), so the very first
  // item placed into an empty trunk needs more than just the overall
  // bounding corner to find a spot that actually clears.
  const regionXEdges = regions.flatMap((r) => [r.xMin, r.xMax]);
  const regionYEdges = regions.flatMap((r) => [r.yMin, r.yMax]);
  const xEdges = candidateAxis([...regionXEdges, ...placed.flatMap((p) => p.worldBoxes.flatMap((b) => [b.x, b.x + b.w]))], bounds.xMin, bounds.xMax);
  const yEdges = candidateAxis([...regionYEdges, ...placed.flatMap((p) => p.worldBoxes.flatMap((b) => [b.y, b.y + b.d]))], bounds.yMin, bounds.yMax);

  const orientations: { orientation: Orientation; yawSwapped: boolean }[] =
    def.shape.kind === 'box'
      ? generateOrientations(def.shape, def.canStandOnEnd, def.orientationsAllowed).map((o) => ({
          orientation: scaleOrientation(o, scale),
          yawSwapped: false,
        }))
      : [
          { orientation: { w: 0, d: 0, h: 0, standingOnEnd: false }, yawSwapped: false },
          { orientation: { w: 0, d: 0, h: 0, standingOnEnd: false }, yawSwapped: true },
        ];

  let best: { score: [number, number, number]; result: PlacementResult } | null = null;

  for (const { orientation, yawSwapped } of orientations) {
    for (const y of yEdges) {
      for (const x of xEdges) {
        const probeOrigin = { x, y, z: 0 };
        const probeBoxes = worldBoxesFor(def.shape, probeOrigin, orientation, yawSwapped);
        const bb = boundingBoxOf(probeBoxes);
        if (bb.x + bb.w > bounds.xMax + 1e-6) continue;
        if (bb.y + bb.d > bounds.yMax + 1e-6) continue;

        // Find the required floor z: highest top of any already-placed box whose
        // footprint overlaps this candidate's footprint.
        let z0 = 0;
        for (const p of placed) {
          for (const ob of p.worldBoxes) {
            const xOverlap = bb.x < ob.x + ob.w - 1e-6 && bb.x + bb.w > ob.x + 1e-6;
            const yOverlap = bb.y < ob.y + ob.d - 1e-6 && bb.y + bb.d > ob.y + 1e-6;
            if (xOverlap && yOverlap) z0 = Math.max(z0, ob.z + ob.h);
          }
        }

        const finalOrigin = { x, y, z: z0 };
        const worldBoxes = worldBoxesFor(def.shape, finalOrigin, orientation, yawSwapped);

        const fits = worldBoxes.every((wb) => boxFitsInCavity(wb, regions, { heightCap }));
        if (!fits) continue;

        const collides = placed.some((p) => p.worldBoxes.some((ob) => worldBoxes.some((wb) => boxesOverlap(wb, ob))));
        if (collides) continue;

        // Score: lowest z first (flat/stable), then deepest into the trunk
        // (largest y — away from the opening, so later items land near it),
        // then centered/lowest x.
        const score: [number, number, number] = [z0, -y, x];
        if (!best || scoreLess(score, best.score)) {
          best = { score, result: { origin: finalOrigin, orientation, yawSwapped, worldBoxes } };
        }
      }
    }
  }

  return best?.result ?? null;
}

function scaleOrientation(o: Orientation, scale: number): Orientation {
  if (scale === 1) return o;
  return { ...o, h: o.h * scale };
}

function scoreLess(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])));
}

/**
 * A sedan's trunk lid swings up, so the "opening" is really the whole top
 * face — anything is reachable unless something else is stacked directly on
 * top of it. A hatchback/SUV/minivan/pickup opens from the rear, so
 * reachability instead depends on nothing sitting closer to that rear plane
 * (y=0) with overlapping footprint/height.
 */
function isReachableFromOpening(
  target: Box,
  others: { instanceId: string; box: Box }[],
  selfInstanceId: string,
  openFromTop: boolean
): boolean {
  return !others.some(({ instanceId, box: o }) => {
    if (instanceId === selfInstanceId) return false;
    const xOverlap = target.x < o.x + o.w - 1e-6 && target.x + target.w > o.x + 1e-6;
    if (!xOverlap) return false;
    if (openFromTop) {
      const yOverlap = target.y < o.y + o.d - 1e-6 && target.y + target.d > o.y + 1e-6;
      const above = o.z + 1e-6 >= target.z + target.h - 1e-6;
      return yOverlap && above;
    }
    const closerToOpening = o.y + 1e-6 < target.y;
    if (!closerToOpening) return false;
    const zOverlap = target.z < o.z + o.h - 1e-6 && target.z + target.h > o.z + 1e-6;
    return zOverlap;
  });
}

export function pack(
  request: PackRequest,
  car: CarProfile,
  itemLibrary: ItemDef[]
): PackPlan {
  const byId = new Map(itemLibrary.map((i) => [i.id, i]));
  const accessibleIds = new Set(request.accessibleItemIds ?? []);
  const instances = expandInstances(request.items, byId, accessibleIds);

  const regions = request.seatsFolded && car.seatsFoldedExtraRegions ? [...car.trunkRegions, ...car.seatsFoldedExtraRegions] : car.trunkRegions;
  const cavityVolume = totalCavityVolume(regions);

  const sightlineCap = car.rearVisibility
    ? (y: number) => interpolateSightline(car.rearVisibility!.points, y)
    : undefined;

  // Load order: base/foundation items first (rigid, largest volume), then
  // smaller rigid items, then soft/compressible fillers, and accessible items
  // pushed to the very end so the position-search's "prefer max y" rule
  // naturally leaves them near the opening/top.
  const sorted = [...instances].sort((a, b) => {
    if (a.accessible !== b.accessible) return a.accessible ? 1 : -1;
    if (a.def.rigid !== b.def.rigid) return a.def.rigid ? -1 : 1;
    return itemVolume(b.def) - itemVolume(a.def);
  });

  const placed: (PlacementResult & { instance: ItemInstance })[] = [];
  const unplaced: UnplacedItem[] = [];
  const warnings: PackWarning[] = [];
  let rearBlocked = false;

  for (let idx = 0; idx < sorted.length; idx++) {
    const inst = sorted[idx];
    const { w, h } = shapeFootprint(inst.def);
    if (!fitsThroughOpening(w, h, car.opening, inst.def.canTiltForClosing)) {
      unplaced.push({
        itemId: inst.def.id,
        itemName: inst.def.name,
        instanceIndex: idx,
        reason: `Won't fit through the trunk opening (${car.opening.width}×${car.opening.height} cm) even tilted.`,
      });
      continue;
    }

    const wantSightlineCap = request.keepRearVisibility ? sightlineCap : undefined;
    let placement = tryPlace(inst.def, regions, placed, wantSightlineCap);
    let usedFallback = false;

    if (!placement && request.keepRearVisibility && request.allowBlockingRearView !== 'never') {
      placement = tryPlace(inst.def, regions, placed, undefined);
      usedFallback = !!placement;
    }

    if (!placement && !inst.def.rigid) {
      const shrink = inst.def.compressibility ?? 0.15;
      for (const scale of [0.85, 0.7, 1 - shrink]) {
        placement = tryPlace(inst.def, regions, placed, wantSightlineCap, scale);
        if (placement) break;
      }
      if (!placement && request.keepRearVisibility && request.allowBlockingRearView !== 'never') {
        for (const scale of [0.85, 0.7, 1 - shrink]) {
          placement = tryPlace(inst.def, regions, placed, undefined, scale);
          if (placement) {
            usedFallback = true;
            break;
          }
        }
      }
    }

    if (!placement) {
      unplaced.push({
        itemId: inst.def.id,
        itemName: inst.def.name,
        instanceIndex: idx,
        reason: 'No remaining space fits this item given what else is packed.',
      });
      continue;
    }

    if (usedFallback) rearBlocked = true;
    placed.push({ ...placement, instance: inst });
  }

  if (rearBlocked) {
    warnings.push({
      code: 'rear-visibility-blocked',
      message: "Couldn't fit everything while keeping the rear window clear — some cargo now sits above the sightline.",
    });
  }

  const allBoxesFlat = placed.flatMap((p) => p.worldBoxes.map((box) => ({ instanceId: p.instance.instanceId, box })));
  const placements: PlacedItem[] = placed.map((p, i) => {
    const bb = boundingBoxOf(p.worldBoxes);
    const isAccessible = p.instance.accessible;
    if (isAccessible) {
      const openFromTop = car.bodyStyle === 'sedan';
      const reachable = p.worldBoxes.every((wb) => isReachableFromOpening(wb, allBoxesFlat, p.instance.instanceId, openFromTop));
      if (!reachable) {
        warnings.push({
          code: 'item-buried-despite-accessible-request',
          message: `${p.instance.def.name} ended up blocked by other cargo — there wasn't enough room near the opening to keep it accessible too.`,
        });
      }
    }
    return {
      order: i + 1,
      instanceId: p.instance.instanceId,
      itemId: p.instance.def.id,
      itemName: p.instance.def.name,
      category: p.instance.def.category,
      position: p.origin,
      size: { w: bb.w, d: bb.d, h: bb.h },
      rotated:
        p.instance.def.shape.kind === 'box' ? p.orientation.w !== p.instance.def.shape.w : p.yawSwapped,
      standingOnEnd: p.orientation.standingOnEnd,
      accessible: isAccessible,
      regionLabel: regionLabelAt(regions, p.origin.x, p.origin.y),
      note: buildNote(p, isAccessible),
    };
  });

  const usedVolume = placements.reduce((s, p) => s + p.size.w * p.size.d * p.size.h, 0);
  const fillRatio = cavityVolume > 0 ? usedVolume / cavityVolume : 0;
  if (fillRatio > 0.92) {
    warnings.push({ code: 'trunk-nearly-full', message: 'The trunk is packed close to its practical limit — expect a tight fit closing the lid.' });
  }
  if (unplaced.length > 0 && !request.seatsFolded && car.seatsFoldedExtraRegions) {
    warnings.push({ code: 'seats-recommended', message: 'Not everything fit — folding a rear seat would free up meaningfully more room.' });
  }

  return {
    carId: car.id,
    placements,
    unplaced,
    warnings,
    cavityVolumeCm3: cavityVolume,
    usedVolumeCm3: usedVolume,
    fillRatio,
    rearBlocked,
  };
}

function buildNote(p: PlacementResult & { instance: ItemInstance }, accessible: boolean): string | undefined {
  const notes: string[] = [];
  if (p.orientation.standingOnEnd) notes.push('stand it on end');
  if (accessible) notes.push('kept near the opening for easy access');
  return notes.length ? notes.join('; ') : undefined;
}

function interpolateSightline(points: { y: number; z: number }[], y: number): number {
  if (points.length === 0) return Infinity;
  if (y <= points[0].y) return points[0].z;
  for (let i = 1; i < points.length; i++) {
    if (y <= points[i].y) {
      const a = points[i - 1];
      const b = points[i];
      const t = (y - a.y) / (b.y - a.y || 1);
      return a.z + t * (b.z - a.z);
    }
  }
  return points[points.length - 1].z;
}
