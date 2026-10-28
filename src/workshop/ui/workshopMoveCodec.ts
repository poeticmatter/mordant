import type { Dye } from '../../engine/shades.ts';
import type { MoveCodec } from '../../ui/gameLog.ts';
import type { WorkshopMove } from '../engine.ts';

/**
 * `s <dye> <cloth>,<x>,<y>,<rotation> …` for a spray (layout bottom first),
 * `q <cloth> <slot> <quarter turns>` for sewing into the quilt, `n` for ending the round.
 */
export const workshopMoveCodec: MoveCodec<WorkshopMove> = {
  encode(move) {
    switch (move.kind) {
      case 'spray':
        return ['s', move.dye, ...move.layout.map((placement) => `${placement.clothId},${placement.x},${placement.y},${placement.rotation}`)].join(' ');
      case 'quilt':
        return `q ${move.clothId} ${move.slot} ${move.turns}`;
      case 'endRound':
        return 'n';
    }
  },
  decode(text) {
    const [kind, ...parts] = text.trim().split(' ');
    if (kind === 'n') return { kind: 'endRound' };
    if (kind === 'q') return { kind: 'quilt', clothId: Number(parts[0]), slot: Number(parts[1]), turns: Number(parts[2]) };
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
