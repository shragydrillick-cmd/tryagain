import type { ItemDef } from '../core/types';
import { buildItemShape } from '../core/shapeBuilders';

/**
 * A hard-shell 4-wheel spinner isn't a solid box down to the floor — it
 * stands on 4 small wheel housings, with the shell body starting above
 * them. Modeling that (rather than one solid box) means the packer's
 * collision check leaves the gap between the wheels genuinely empty, so a
 * thin flat item can actually slide underneath it, the way it would in
 * real life.
 */
function wheeledSuitcase(w: number, d: number, h: number, wheelSize: number) {
  return buildItemShape(w, d, h, [{ kind: 'corners4', size: wheelSize }]);
}

/**
 * Seed item library. Dimensions are cm, converted from commonly published
 * inch specs for each category (see sourceNote per item) — real items vary
 * by brand/model, which is exactly why "save your own" custom items with
 * exact measured dimensions exist alongside this shared library. A few
 * entries are specific named products, researched and sourced directly
 * (including their wheel/handle protrusions), not generic estimates —
 * marked below.
 */
export const ITEMS: ItemDef[] = [
  {
    id: 'suitcase-carryon-hard',
    name: 'Carry-on suitcase (hard-shell)',
    category: 'luggage',
    shape: wheeledSuitcase(55.9, 22.9, 35.6, 4),
    rigid: true,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Standard carry-on spec: 22×14×9 in (wheels included, as quoted), modeled with 4 corner wheel housings ~4cm tall.',
  },
  {
    id: 'suitcase-away-carryon',
    name: 'Away "The Carry-On" (hard-shell)',
    category: 'luggage',
    shape: wheeledSuitcase(36.6, 22.9, 55.1, 4),
    rigid: true,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Named product, researched: awaytravel.com lists 21.7×14.4×9 in exterior (handles and wheels included, as they state); modeled with 4 corner wheel housings ~4cm tall.',
  },
  {
    id: 'suitcase-large-checked',
    name: 'Large checked suitcase',
    category: 'luggage',
    shape: wheeledSuitcase(76.2, 30.5, 50.8, 5),
    rigid: true,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Typical large checked bag: 30×12×20 in (wheels included, as quoted), modeled with 4 corner wheel housings ~5cm tall.',
  },
  {
    id: 'suitcase-medium-checked',
    name: 'Medium checked suitcase',
    category: 'luggage',
    shape: wheeledSuitcase(66.0, 27.9, 45.7, 4.5),
    rigid: true,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Typical medium checked bag: 26×11×18 in (wheels included, as quoted), modeled with 4 corner wheel housings ~4.5cm tall.',
  },
  {
    id: 'duffel-bag',
    name: 'Duffel bag',
    category: 'soft-bags',
    shape: { kind: 'box', w: 71.1, d: 35.6, h: 35.6 },
    rigid: false,
    compressibility: 0.35,
    canStandOnEnd: false,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Common large duffel: 28×14×14 in.',
  },
  {
    id: 'backpack',
    name: 'Backpack',
    category: 'soft-bags',
    shape: { kind: 'box', w: 33.0, d: 22.9, h: 50.8 },
    rigid: false,
    compressibility: 0.25,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Typical full-size travel backpack: 20×9×13 in.',
  },
  {
    id: 'stroller-full-size-folded',
    name: 'Full-size stroller (folded)',
    category: 'baby-gear',
    shape: {
      kind: 'compound',
      boxes: [
        // wheel cluster: low and wide, concentrated near one end
        { dx: 0, dy: 0, dz: 0, w: 58.9, d: 20, h: 14 },
        // folded frame body: narrower, sits above/behind the wheel cluster
        { dx: 9.5, dy: 0, dz: 14, w: 40, d: 86.4, h: 22.3 },
      ],
    },
    rigid: true,
    canStandOnEnd: false,
    canTiltForClosing: true,
    orientationsAllowed: 'flatOnly',
    sourceNote:
      'Approximated from typical folded full-size stroller specs (~34×23×14 in). Kept flat (wheelbase down) rather than stood on its side — geometrically the packer could do that too, but it is not how you would actually carry a stroller with a wide wheel splay.',
  },
  {
    id: 'stroller-uppababy-vista',
    name: 'UPPAbaby Vista V3 (folded, seat attached)',
    category: 'baby-gear',
    shape: {
      kind: 'compound',
      boxes: [
        // wheelbase: the 11.5in rear wheels dominate the folded footprint width
        { dx: 0, dy: 0, dz: 0, w: 65.3, d: 25, h: 29.2 },
        // frame body above the wheels, spanning the full folded depth
        { dx: 12.65, dy: 0, dz: 29.2, w: 40, d: 43.9, h: 55.4 },
      ],
    },
    rigid: true,
    canStandOnEnd: false,
    canTiltForClosing: true,
    orientationsAllowed: 'flatOnly',
    sourceNote:
      'Named product, researched: UPPAbaby/support pages list 17.3×25.7×33.3 in folded with the seat attached, plus 11.5 in rear / 8 in front wheel diameters used to size the wheelbase zone.',
  },
  {
    id: 'stroller-umbrella-folded',
    name: 'Umbrella stroller (folded)',
    category: 'baby-gear',
    shape: { kind: 'box', w: 22.9, d: 104.1, h: 22.9 },
    rigid: true,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Typical umbrella stroller folds to roughly 41×9×9 in — long and thin.',
  },
  {
    id: 'golf-bag',
    name: 'Golf bag (standing)',
    category: 'sports',
    shape: {
      kind: 'compound',
      boxes: [
        // narrow base
        { dx: 5.1, dy: 5.1, dz: 0, w: 25.4, d: 25.4, h: 60 },
        // wider top where clubs/pockets flare out
        { dx: 0, dy: 0, dz: 60, w: 35.6, d: 35.6, h: 31.4 },
      ],
    },
    rigid: true,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Typical standing golf bag: ~36 in tall, 10 in base diameter, flaring to ~14 in at the top pockets. Can also be laid on its side, which the packer will do if that fits better.',
  },
  {
    id: 'cooler-medium',
    name: 'Cooler (medium, hard-shell)',
    category: 'outdoor',
    shape: { kind: 'box', w: 63.5, d: 40.6, h: 40.6 },
    rigid: true,
    canStandOnEnd: false,
    canTiltForClosing: false,
    orientationsAllowed: 'uprightOnly',
    sourceNote: 'Typical medium hard cooler: 25×16×16 in. Kept upright to avoid spilling ice/contents.',
  },
  {
    id: 'cooler-yeti-roadie-24',
    name: 'YETI Roadie 24 (hard cooler)',
    category: 'outdoor',
    shape: { kind: 'box', w: 42.2, d: 35.6, h: 44.2 },
    rigid: true,
    canStandOnEnd: false,
    canTiltForClosing: false,
    orientationsAllowed: 'uprightOnly',
    sourceNote:
      'Named product, researched: yeti.com lists 16.6×14×17.4 in exterior. Modeled as a plain box — its molded-in handle sits flush with the shell rather than sticking out, unlike a suitcase\'s wheels.',
  },
  {
    id: 'moving-box-medium',
    name: 'Moving box (medium)',
    category: 'boxes',
    shape: { kind: 'box', w: 45.7, d: 45.7, h: 40.6 },
    rigid: true,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Standard medium moving box: 18×18×16 in.',
  },
  {
    id: 'moving-box-large',
    name: 'Moving box (large)',
    category: 'boxes',
    shape: { kind: 'box', w: 61.0, d: 45.7, h: 45.7 },
    rigid: true,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Standard large moving box: 24×18×18 in.',
  },
  {
    id: 'beach-chair-folded',
    name: 'Folding camp/beach chair',
    category: 'outdoor',
    shape: { kind: 'box', w: 20.3, d: 20.3, h: 109.2 },
    rigid: true,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Typical folded camp chair: ~43×8×8 in.',
  },
  {
    id: 'water-case',
    name: 'Case of bottled water',
    category: 'boxes',
    shape: { kind: 'box', w: 40.6, d: 25.4, h: 30.5 },
    rigid: true,
    canStandOnEnd: false,
    canTiltForClosing: false,
    orientationsAllowed: 'flatOnly',
    sourceNote: 'Typical 24-pack case: 16×10×12 in. Kept flat rather than stood on end.',
  },
  {
    id: 'yoga-mat-rolled',
    name: 'Rolled yoga/camping mat',
    category: 'soft-bags',
    shape: { kind: 'box', w: 70, d: 15, h: 15 },
    rigid: false,
    compressibility: 0.15,
    canStandOnEnd: true,
    canTiltForClosing: true,
    orientationsAllowed: 'any',
    sourceNote: 'Typical rolled mat: ~70×15×15 cm.',
  },
  {
    id: 'child-car-seat',
    name: 'Child car seat',
    category: 'baby-gear',
    shape: { kind: 'box', w: 50.8, d: 50.8, h: 68.6 },
    rigid: true,
    canStandOnEnd: false,
    canTiltForClosing: false,
    orientationsAllowed: 'uprightOnly',
    fragile: true,
    sourceNote: 'Typical convertible car seat footprint/height: ~20×20×27 in. Kept upright — not designed to be laid on its side under load.',
  },
  {
    id: 'document-folio',
    name: 'Flat document/laptop folio',
    category: 'flat-items',
    shape: { kind: 'box', w: 40, d: 30, h: 3 },
    rigid: true,
    canStandOnEnd: false,
    canTiltForClosing: true,
    orientationsAllowed: 'flatOnly',
    sourceNote: 'Thin enough (~3cm) to actually slide into the gap under a wheeled suitcase\'s body, between its wheel housings — a real example of "what sticks out" mattering for the fit, not just overall volume.',
  },
];

export function getItemById(id: string): ItemDef | undefined {
  return ITEMS.find((i) => i.id === id);
}
