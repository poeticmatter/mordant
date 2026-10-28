import type { TagsMove } from '../selvedge/tags/engine.ts';
import type { MoveCodec } from './gameLog.ts';

/** `h <cloth> <peg> <quarter turns>` for a hang, `a <cloth>` for setting a cloth aside, `i` for calling the inspection early. */
export const tagsMoveCodec: MoveCodec<TagsMove> = {
  encode(move) {
    switch (move.kind) {
      case 'hang':
        return `h ${move.clothId} ${move.cell} ${move.turns}`;
      case 'setAside':
        return `a ${move.clothId}`;
      case 'inspect':
        return 'i';
    }
  },
  decode(text) {
    const [kind, clothId, cell, turns] = text.trim().split(' ');
    if (kind === 'i') return { kind: 'inspect' };
    if (kind === 'h') return { kind: 'hang', clothId: Number(clothId), cell: Number(cell), turns: Number(turns) };
    if (kind === 'a') return { kind: 'setAside', clothId: Number(clothId) };
    throw new Error(`Unrecognised logged move "${text}"`);
  },
};
