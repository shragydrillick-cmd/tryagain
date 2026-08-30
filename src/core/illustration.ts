import type { CarProfile, PackPlan, PlacedItem } from './types';

export interface DrawRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  opacity: number;
  label?: string;
  isCurrent?: boolean;
}

export interface IllustrationScene {
  width: number;
  height: number;
  cavityOutline: DrawRect[];
  items: DrawRect[];
}

const PALETTE = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5',
];

export function colorForCategory(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function fitScale(carW: number, carD: number, targetW: number, targetH: number, padding: number): number {
  return Math.min((targetW - padding * 2) / carW, (targetH - padding * 2) / carD);
}

/** Top-down (bird's-eye) view: screen-x = trunk x, screen-y = trunk depth
 * flipped so the opening (y=0) sits at the bottom of the image, like looking
 * down into the trunk from above while standing behind the car. */
export function computeTopDownScene(car: CarProfile, plan: PackPlan, uptoStep: number, targetW = 320, targetH = 320): IllustrationScene {
  const regions = car.trunkRegions;
  const carW = Math.max(...regions.map((r) => r.xMax));
  const carD = Math.max(...regions.map((r) => r.yMax));
  const padding = 16;
  const scale = fitScale(carW, carD, targetW, targetH, padding);

  const toScreen = (x: number, y: number) => ({ sx: padding + x * scale, sy: padding + (carD - y) * scale });

  const cavityOutline: DrawRect[] = regions.map((r) => {
    const top = toScreen(r.xMin, r.yMax);
    return {
      x: top.sx,
      y: top.sy,
      w: (r.xMax - r.xMin) * scale,
      h: (r.yMax - r.yMin) * scale,
      fill: '#e5e7eb',
      stroke: '#9ca3af',
      opacity: 1,
      label: r.label,
    };
  });

  const items: DrawRect[] = plan.placements
    .filter((p) => p.order <= uptoStep)
    .map((p) => rectForItem(p, toScreen, scale, uptoStep, 'top'));

  return { width: targetW, height: targetH, cavityOutline, items };
}

/** Side (profile) view: screen-x = trunk depth (opening on the left), screen-y = height, flipped upward. */
export function computeSideScene(car: CarProfile, plan: PackPlan, uptoStep: number, targetW = 320, targetH = 220): IllustrationScene {
  const regions = car.trunkRegions;
  const carD = Math.max(...regions.map((r) => r.yMax));
  const carH = Math.max(...regions.map((r) => r.zMax));
  const padding = 16;
  const scale = fitScale(carD, carH, targetW, targetH, padding);

  const toScreen = (y: number, z: number) => ({ sx: padding + y * scale, sy: padding + (carH - z) * scale });

  const cavityOutline: DrawRect[] = regions.map((r) => {
    const top = toScreen(r.yMin, r.zMax);
    return {
      x: top.sx,
      y: top.sy,
      w: (r.yMax - r.yMin) * scale,
      h: (r.zMax - r.zMin) * scale,
      fill: '#e5e7eb',
      stroke: '#9ca3af',
      opacity: 1,
      label: r.label,
    };
  });

  const items: DrawRect[] = plan.placements
    .filter((p) => p.order <= uptoStep)
    .map((p) => rectForItem(p, toScreen, scale, uptoStep, 'side'));

  return { width: targetW, height: targetH, cavityOutline, items };
}

function rectForItem(
  p: PlacedItem,
  toScreen: (a: number, b: number) => { sx: number; sy: number },
  scale: number,
  uptoStep: number,
  view: 'top' | 'side'
): DrawRect {
  const isCurrent = p.order === uptoStep;
  const color = colorForCategory(p.category);
  if (view === 'top') {
    const topLeft = toScreen(p.position.x, p.position.y + p.size.d);
    return {
      x: topLeft.sx,
      y: topLeft.sy,
      w: p.size.w * scale,
      h: p.size.d * scale,
      fill: color,
      stroke: isCurrent ? '#111827' : '#ffffff',
      opacity: isCurrent ? 0.95 : 0.65,
      label: p.itemName,
      isCurrent,
    };
  }
  const topLeft = toScreen(p.position.y, p.position.z + p.size.h);
  return {
    x: topLeft.sx,
    y: topLeft.sy,
    w: p.size.d * scale,
    h: p.size.h * scale,
    fill: color,
    stroke: isCurrent ? '#111827' : '#ffffff',
    opacity: isCurrent ? 0.95 : 0.65,
    label: p.itemName,
    isCurrent,
  };
}
