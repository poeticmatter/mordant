import { describe, expect, it } from 'vitest';
import { BLUE, RED, YELLOW } from '../../engine/shades.ts';
import { LEFT, RIGHT, TOP } from '../grid.ts';
import { RULES_V8 } from './config.ts';
import {
  applyMove,
  BROWN,
  createGame,
  IllegalMoveError,
  isSpoiled,
  isTagMet,
  legalMoves,
  mixOf,
  shippedCount,
  tagProgress,
  turnedEdges,
  type TagsConfig,
  type TagsState,
} from './engine.ts';

const ORANGE = mixOf(RED) | mixOf(YELLOW);
const PURPLE = mixOf(RED) | mixOf(BLUE);
const PLAIN_RED = mixOf(RED);

/** A game whose hand holds cloths of the given colours, so tests can set up exact touches. */
function gameWithHand(colours: readonly number[], config: TagsConfig = RULES_V8): TagsState {
  const state = createGame(7, config);
  const hand: number[] = [];
  for (const colour of colours) hand.push(state.cloths.find((cloth) => cloth.body === colour && !hand.includes(cloth.id))!.id);
  return { ...state, hand, drawPile: state.cloths.map((cloth) => cloth.id).filter((id) => !hand.includes(id)) };
}

function hang(state: TagsState, clothId: number, cell: number, turns = 0): TagsState {
  return applyMove(state, { kind: 'hang', clothId, cell, turns });
}

describe('mixing', () => {
  it('mixes both colours into the edges two touching cloths share', () => {
    let state = gameWithHand([RED, BLUE, YELLOW]);
    const [red, blue] = state.hand;
    state = hang(hang(state, red, 0), blue, 1);
    expect([state.cloths[red].edges[RIGHT], state.cloths[blue].edges[LEFT]]).toEqual([PURPLE, mixOf(BLUE) | mixOf(RED)]);
  });

  it('leaves edges that touch nothing in the cloth’s own colour', () => {
    let state = gameWithHand([RED, BLUE, YELLOW]);
    const [red, blue] = state.hand;
    state = hang(hang(state, red, 0), blue, 1);
    expect(state.cloths[red].edges[TOP]).toBe(mixOf(RED));
  });

  it('turns an edge brown when a third primary reaches it', () => {
    const state = gameWithHand([RED, YELLOW, BLUE]);
    const red = state.cloths[state.hand[0]];
    red.edges[RIGHT] = ORANGE;
    const blue = state.hand[2];
    const after = hang(hang(state, red.id, 0), blue, 1);
    expect(after.cloths[red.id].edges[RIGHT]).toBe(BROWN);
  });
});

describe('turning', () => {
  it('moves the top edge to the right on one quarter turn', () => {
    expect(turnedEdges(['top', 'right', 'bottom', 'left'], 1)).toEqual(['left', 'top', 'right', 'bottom']);
  });

  it('keeps a cloth turned the way it was hung', () => {
    const state = gameWithHand([RED, YELLOW, BLUE]);
    const red = state.cloths[state.hand[0]];
    red.edges[TOP] = ORANGE;
    const after = hang(state, red.id, 5, 1);
    expect(after.cloths[red.id].edges[RIGHT]).toBe(ORANGE);
  });

  it('rejects a turn when turning is switched off', () => {
    const state = gameWithHand([RED, YELLOW, BLUE], { ...RULES_V8, allowsTurning: false });
    expect(() => hang(state, state.hand[0], 0, 1)).toThrow(IllegalMoveError);
  });
});

describe('tags', () => {
  const look = { body: RED, tag: [PLAIN_RED, ORANGE, ORANGE, PURPLE] };

  it('counts wanted edges on any side', () => {
    expect(tagProgress({ ...look, edges: [PLAIN_RED, ORANGE, PURPLE, PLAIN_RED] })).toBe(3);
  });

  it('is met once all four edges are as wanted', () => {
    expect(isTagMet({ ...look, edges: [ORANGE, PURPLE, PLAIN_RED, ORANGE] })).toBe(true);
  });

  it('is never met by a cloth with a brown edge', () => {
    expect(isTagMet({ ...look, edges: [ORANGE, PURPLE, BROWN, ORANGE] })).toBe(false);
  });

  it('names all four edges on every cloth', () => {
    expect(createGame(3, RULES_V8).cloths.every((cloth) => cloth.tag.length === 4)).toBe(true);
  });
});

describe('spoiling', () => {
  const look = { body: RED, tag: [PLAIN_RED, PLAIN_RED, ORANGE, PURPLE] };

  it('spoils a cloth with more edges of a mix than its tag wants', () => {
    expect(isSpoiled({ ...look, edges: [ORANGE, ORANGE, PLAIN_RED, PLAIN_RED] })).toBe(true);
  });

  it('spoils a cloth with a brown edge', () => {
    expect(isSpoiled({ ...look, edges: [BROWN, PLAIN_RED, PLAIN_RED, PLAIN_RED] })).toBe(true);
  });

  it('does not spoil a cloth whose extra edges are still plain', () => {
    expect(isSpoiled({ ...look, edges: [PLAIN_RED, PLAIN_RED, PLAIN_RED, ORANGE] })).toBe(false);
  });
});

describe('seasons', () => {
  it('ships a cloth whose tag is met at inspection, and never deals it again', () => {
    let state = gameWithHand([RED, YELLOW, BLUE]);
    const [red, yellow] = state.hand;
    state.cloths[red].tag = [PLAIN_RED, PLAIN_RED, PLAIN_RED, ORANGE];
    state = applyMove(hang(hang(state, red, 0), yellow, 1), { kind: 'inspect' });
    expect([shippedCount(state) >= 1, state.drawPile.includes(red) || state.hand.includes(red)]).toEqual([true, false]);
  });

  it('carries mixed edges into the next season', () => {
    let state = gameWithHand([RED, BLUE, YELLOW]);
    const [red, blue] = state.hand;
    state.cloths[red].tag = [ORANGE, ORANGE, ORANGE, ORANGE];
    state = applyMove(hang(hang(state, red, 0), blue, 1), { kind: 'inspect' });
    expect(state.cloths[red].edges[RIGHT]).toBe(PURPLE);
  });

  it('ends after the last season', () => {
    let state = createGame(11, RULES_V8);
    while (!state.isOver) state = applyMove(state, legalMoves(state).find((move) => move.kind === 'hang') ?? legalMoves(state)[0]);
    expect(state.season).toBe(RULES_V8.seasons);
  });
});

describe('setting aside', () => {
  it('removes the cloth and draws a replacement', () => {
    const state = createGame(5, RULES_V8);
    const [first] = state.hand;
    const after = applyMove(state, { kind: 'setAside', clothId: first });
    expect([after.hand.includes(first), after.hand.length]).toEqual([false, state.hand.length]);
  });
});
