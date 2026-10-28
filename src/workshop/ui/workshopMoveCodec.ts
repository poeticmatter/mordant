import type { Dye } from '../../engine/shades.ts';
import type { MoveCodec } from '../../ui/gameLog.ts';
import type { WorkshopMove } from '../engine.ts';

/** `s <dye> <cloth>,<x>,<y>,<rotation> …` for a spray (layout bottom first). */
export const workshopMoveCodec: MoveCodec<WorkshopMove> = {
  encode(move) {
    return ['s', move.dye, ...move.layout.map((placement) => `${placement.clothId},${placement.x},${placement.y},${placement.rotation}`)].join(' ');
  },
  decode(text) {
    const [kind, ...parts] = text.trim().split(' ');
    if (kind === 's') {
      const [dye, ...placements] = parts;
      return {
        kind: 'spray',
        dye: Number(dye) as Dye, // encoded from a Dye above
        layout: placements.map((entry) => {
          const [clothId, x, y, rotation] = entry.split(',').map(Number);
          return { clothId, x, y, rotation };
        }),
      };
    }
    throw new Error(`Unrecognised logged move "${text}"`);
  },
};
