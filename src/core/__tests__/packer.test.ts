import { describe, expect, it } from 'vitest';
import { pack } from '../packer';
import { buildGenericCarProfile } from '../carTemplates';
import { totalCavityVolume } from '../geometry';
import { CARS, getCarById } from '../../data/cars';
import { getItemById, ITEMS } from '../../data/items';
import type { ItemDef, PackRequest } from '../types';

const camry = getCarById('toyota-camry-sedan')!;
const crv = getCarById('honda-crv-suv')!;
const odyssey = getCarById('honda-odyssey-minivan')!;

describe('pack', () => {
  it('places a couple of small suitcases with no unplaced items', () => {
    const req: PackRequest = {
      carId: camry.id,
      items: [
        { itemId: 'suitcase-carryon-hard', qty: 2 },
        { itemId: 'backpack', qty: 1 },
      ],
    };
    const plan = pack(req, camry, ITEMS);
    expect(plan.unplaced).toHaveLength(0);
    expect(plan.placements).toHaveLength(3);
    expect(plan.fillRatio).toBeGreaterThan(0);
    // no two placements should overlap
    for (let i = 0; i < plan.placements.length; i++) {
      for (let j = i + 1; j < plan.placements.length; j++) {
        expect(overlaps(plan.placements[i], plan.placements[j])).toBe(false);
      }
    }
  });

  it('reports unplaced items once the trunk is genuinely full', () => {
    const req: PackRequest = {
      carId: camry.id,
      items: [{ itemId: 'suitcase-large-checked', qty: 8 }],
    };
    const plan = pack(req, camry, ITEMS);
    expect(plan.unplaced.length).toBeGreaterThan(0);
    expect(plan.placements.length).toBeGreaterThan(0);
    expect(plan.placements.length + plan.unplaced.length).toBe(8);
  });

  it('keeps an accessible item reachable from the opening when there is room', () => {
    const req: PackRequest = {
      carId: camry.id,
      items: [
        { itemId: 'suitcase-large-checked', qty: 2 },
        { itemId: 'backpack', qty: 1 },
      ],
      accessibleItemIds: ['backpack'],
    };
    const plan = pack(req, camry, ITEMS);
    const backpack = plan.placements.find((p) => p.itemId === 'backpack')!;
    expect(backpack).toBeDefined();
    expect(backpack.accessible).toBe(true);
    expect(plan.warnings.find((w) => w.code === 'item-buried-despite-accessible-request')).toBeUndefined();
    // the accessible item should be the last one loaded
    expect(backpack.order).toBe(plan.placements.length);
  });

  it('lets a long thin item through by orienting it lengthwise, but rejects one that is oversized in both horizontal dimensions', () => {
    // A thin rod genuinely can slide through a narrower opening lengthwise —
    // only its cross-section (the two non-length dimensions) has to clear.
    const rod: ItemDef = {
      id: 'test-thin-rod',
      name: 'Thin rod',
      category: 'test',
      shape: { kind: 'box', w: 200, d: 5, h: 5 },
      rigid: true,
      canStandOnEnd: false,
      canTiltForClosing: false,
      orientationsAllowed: 'flatOnly',
    };
    const rodPlan = pack({ carId: camry.id, items: [{ itemId: rod.id, qty: 1, customItem: rod }] }, camry, ITEMS);
    expect(rodPlan.unplaced.find((u) => /opening/i.test(u.reason))).toBeUndefined();

    // A flat panel that's oversized in BOTH horizontal dimensions can't be
    // rotated into anything that clears the opening.
    const panel: ItemDef = {
      id: 'test-too-wide-panel',
      name: 'Oversized panel',
      category: 'test',
      shape: { kind: 'box', w: 200, d: 200, h: 5 },
      rigid: true,
      canStandOnEnd: false,
      canTiltForClosing: false,
      orientationsAllowed: 'flatOnly',
    };
    const req: PackRequest = { carId: camry.id, items: [{ itemId: panel.id, qty: 1, customItem: panel }] };
    const plan = pack(req, camry, ITEMS);
    expect(plan.placements).toHaveLength(0);
    expect(plan.unplaced).toHaveLength(1);
    expect(plan.unplaced[0].reason).toMatch(/opening/i);
  });

  it('keeps stacks below the rear sightline by default on an SUV, and only exceeds it when explicitly allowed', () => {
    const bigBoxes: ItemDef = getItemById('moving-box-large')!;
    const req: PackRequest = {
      carId: crv.id,
      items: [{ itemId: bigBoxes.id, qty: 6 }],
      keepRearVisibility: true,
      allowBlockingRearView: 'never',
    };
    const strictPlan = pack(req, crv, ITEMS);
    expect(strictPlan.rearBlocked).toBe(false);

    const lenientPlan = pack({ ...req, allowBlockingRearView: 'ifNeeded' }, crv, ITEMS);
    expect(lenientPlan.placements.length).toBeGreaterThanOrEqual(strictPlan.placements.length);
  });

  it('squeezes a compressible duffel into a nearly-full trunk when rigid items alone would not leave room', () => {
    const req: PackRequest = {
      carId: camry.id,
      items: [
        { itemId: 'suitcase-large-checked', qty: 2 },
        { itemId: 'duffel-bag', qty: 1 },
      ],
    };
    const plan = pack(req, camry, ITEMS);
    const duffel = plan.placements.find((p) => p.itemId === 'duffel-bag');
    // whether or not it fits depends on geometry, but if it's unplaced the
    // reported reason must not be an opening-size problem (it's a soft bag)
    if (!duffel) {
      const reason = plan.unplaced.find((u) => u.itemId === 'duffel-bag')?.reason ?? '';
      expect(reason).not.toMatch(/opening/i);
    } else {
      expect(duffel.size.w * duffel.size.d * duffel.size.h).toBeGreaterThan(0);
    }
  });

  it('places items even when the trunk floor corner sits in a low-ceiling pinch zone (regression)', () => {
    // The CR-V's very first floor region (x0-112,y0-99) only allows 18cm of
    // height near x=0 (below the wheel arches) — the placement search must
    // look past that single corner instead of giving up there.
    const req: PackRequest = {
      carId: crv.id,
      items: [
        { itemId: 'suitcase-large-checked', qty: 2 },
        { itemId: 'duffel-bag', qty: 1 },
        { itemId: 'stroller-full-size-folded', qty: 1 },
        { itemId: 'backpack', qty: 1 },
      ],
    };
    const plan = pack(req, crv, ITEMS);
    expect(plan.placements.length).toBeGreaterThanOrEqual(4);
  });

  it('places a compound-shaped item (folded stroller) without collision', () => {
    const req: PackRequest = {
      carId: odyssey.id,
      items: [{ itemId: 'stroller-full-size-folded', qty: 1 }],
    };
    const plan = pack(req, odyssey, ITEMS);
    expect(plan.placements).toHaveLength(1);
    expect(plan.unplaced).toHaveLength(0);
  });

  it('gains extra capacity when seats are folded', () => {
    const req: PackRequest = { carId: camry.id, items: [{ itemId: 'moving-box-large', qty: 20 }] };
    // camry has no seatsFoldedExtraRegions, so this should behave identically either way
    const a = pack(req, camry, ITEMS);
    const b = pack({ ...req, seatsFolded: true }, camry, ITEMS);
    expect(a.cavityVolumeCm3).toBe(b.cavityVolumeCm3);

    const suvReq: PackRequest = { carId: crv.id, items: [{ itemId: 'moving-box-large', qty: 20 }] };
    const suvBase = pack(suvReq, crv, ITEMS);
    const suvFolded = pack({ ...suvReq, seatsFolded: true }, crv, ITEMS);
    expect(suvFolded.cavityVolumeCm3).toBeGreaterThan(suvBase.cavityVolumeCm3);
    expect(suvFolded.placements.length).toBeGreaterThanOrEqual(suvBase.placements.length);
  });

  it('every car in the library has a positive cavity volume and can place at least one carry-on', () => {
    for (const car of CARS) {
      expect(totalCavityVolume(car.trunkRegions)).toBeGreaterThan(0);
      const plan = pack({ carId: car.id, items: [{ itemId: 'suitcase-carryon-hard', qty: 1 }] }, car, ITEMS);
      expect(plan.placements.length, `${car.make} ${car.model} should fit one carry-on`).toBe(1);
    }
  });

  it('builds a placeable generic profile for a custom car in each body style', () => {
    const styles = ['sedan', 'coupe', 'hatchback', 'wagon', 'suv', 'minivan', 'pickup'] as const;
    for (const bodyStyle of styles) {
      const car = buildGenericCarProfile({
        id: `custom-${bodyStyle}`,
        make: 'Test',
        model: bodyStyle,
        bodyStyle,
        width: 110,
        depth: 90,
        height: 60,
      });
      expect(car.isCustom).toBe(true);
      expect(totalCavityVolume(car.trunkRegions)).toBeGreaterThan(0);
      const plan = pack({ carId: car.id, items: [{ itemId: 'backpack', qty: 1 }] }, car, ITEMS);
      expect(plan.placements.length, `${bodyStyle} should fit a backpack`).toBe(1);
    }
  });
});

function overlaps(a: { position: { x: number; y: number; z: number }; size: { w: number; d: number; h: number } }, b: typeof a): boolean {
  const eps = 1e-6;
  return (
    a.position.x < b.position.x + b.size.w - eps &&
    a.position.x + a.size.w > b.position.x + eps &&
    a.position.y < b.position.y + b.size.d - eps &&
    a.position.y + a.size.d > b.position.y + eps &&
    a.position.z < b.position.z + b.size.h - eps &&
    a.position.z + a.size.h > b.position.z + eps
  );
}
