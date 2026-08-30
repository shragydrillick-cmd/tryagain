import type { PackPlan } from './types';

export interface InstructionStep {
  order: number;
  title: string;
  detail: string;
  accessible: boolean;
}

const ORDINALS = ['First', 'Next', 'Then', 'After that', 'Next', 'Then', 'After that'];

function ordinalFor(index: number): string {
  if (index === 0) return 'First';
  if (index < ORDINALS.length) return ORDINALS[index];
  return 'Next';
}

export function buildInstructions(plan: PackPlan): InstructionStep[] {
  return plan.placements.map((p, i) => {
    const placement = describePlacement(p);
    const orientation = p.standingOnEnd ? ', standing it on end' : p.rotated ? ', turned sideways to fit' : '';
    const accessNote = p.accessible ? ' Keep it near the top — you wanted this one within reach.' : '';
    const extra = p.note && !p.note.includes('kept near the opening') ? ` (${p.note}).` : '.';
    return {
      order: i + 1,
      title: `${ordinalFor(i)}: load the ${p.itemName}`,
      detail: `Place the ${p.itemName} ${placement}${orientation}${extra}${accessNote}`,
      accessible: p.accessible,
    };
  });
}

function describePlacement(p: PackPlan['placements'][number]): string {
  const depthWord = p.position.y > 40 ? 'against the back seats' : p.position.y > 15 ? 'toward the middle of the trunk' : 'right at the opening';
  const sideWord = p.position.x < 20 ? 'on the left side' : 'on the right side';
  const heightWord = p.position.z > 30 ? 'on top of what\'s already in' : 'on the floor';
  return `${depthWord}, ${sideWord}, ${heightWord}`;
}

export function summarize(plan: PackPlan): string {
  const pct = Math.round(plan.fillRatio * 100);
  const parts = [`Trunk is about ${pct}% full with ${plan.placements.length} item${plan.placements.length === 1 ? '' : 's'} packed.`];
  if (plan.unplaced.length) {
    parts.push(`${plan.unplaced.length} item${plan.unplaced.length === 1 ? "" : 's'} didn't fit.`);
  }
  if (plan.rearBlocked) {
    parts.push('Rear visibility is partially blocked.');
  }
  return parts.join(' ');
}
