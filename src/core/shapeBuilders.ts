import type { ItemShape } from './types';

/**
 * Shared shape-assembly logic for anything sticking out beyond an item's
 * main body — wheels, a telescoping handle housing, a strap or pocket.
 * Used both to author the seed library (src/data/items.ts) and by the
 * "add your own item" wizard, so a user-entered item gets the same
 * box-union modeling as the curated ones instead of a plain box.
 *
 * A protrusion "eats into" the overall height the user measured (wheels at
 * the bottom, a handle at the top) rather than adding to it — that matches
 * how people naturally measure an item (top to bottom, wheels and handle
 * included) and how most published specs are already quoted.
 */
export type ProtrusionSpec =
  | { kind: 'corners4'; label?: string; size: number }
  | { kind: 'edge2'; label?: string; size: number }
  | { kind: 'topHandle'; label?: string; size: number; widthFraction?: number }
  | { kind: 'custom'; label?: string; dx: number; dy: number; dz: number; w: number; d: number; h: number };

type CompoundBox = Extract<ItemShape, { kind: 'compound' }>['boxes'][number];

export function buildItemShape(w: number, d: number, h: number, protrusions: ProtrusionSpec[]): ItemShape {
  if (protrusions.length === 0) return { kind: 'box', w, d, h };

  const inset = 2;
  let bottomEat = 0;
  let topEat = 0;
  for (const p of protrusions) {
    if (p.kind === 'corners4' || p.kind === 'edge2') bottomEat = Math.max(bottomEat, p.size);
    if (p.kind === 'topHandle') topEat = Math.max(topEat, p.size);
  }

  const boxes: CompoundBox[] = [];
  for (const p of protrusions) {
    if (p.kind === 'corners4') {
      const xs = [inset, w - inset - p.size];
      const ys = [inset, d - inset - p.size];
      for (const dx of xs) for (const dy of ys) boxes.push({ dx, dy, dz: 0, w: p.size, d: p.size, h: p.size });
    } else if (p.kind === 'edge2') {
      const xs = [inset, w - inset - p.size];
      for (const dx of xs) boxes.push({ dx, dy: Math.max(0, d - p.size), dz: 0, w: p.size, d: p.size, h: p.size });
    } else if (p.kind === 'topHandle') {
      const hw = w * (p.widthFraction ?? 0.6);
      const hd = Math.min(8, d);
      boxes.push({ dx: (w - hw) / 2, dy: Math.max(0, d - hd), dz: h - p.size, w: hw, d: hd, h: p.size });
    } else if (p.kind === 'custom') {
      boxes.push({ dx: p.dx, dy: p.dy, dz: p.dz, w: p.w, d: p.d, h: p.h });
    }
  }

  const bodyHeight = Math.max(1, h - bottomEat - topEat);
  boxes.push({ dx: 0, dy: 0, dz: bottomEat, w, d, h: bodyHeight });

  return { kind: 'compound', boxes };
}
