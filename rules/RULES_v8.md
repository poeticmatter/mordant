# Selvedge — Rules v8 (playtest round 4)

A redesign after round 3. Everything is in the deck: each cloth carries its own order. Dyes mix instead of
swapping, and cloths can be turned.

## Components
- **18 cloths**: 6 Red, 6 Yellow, 6 Blue. A cloth's own colour never changes.
- **Edges.** Each cloth has four edges. Every edge starts **plain**, in the cloth's own colour.
- **Tags.** Each cloth has a tag naming the colour its customer wants on each of its four edges, on any sides.
  Per colour, the six copies want 2, 2, 3, 3, 3 and 4 mixed edges; the rest plain. Each mixed edge is one of
  the two secondaries that colour can make (red: orange or purple), dealt at random from the seed.
- **Drying rack**: 3 × 3 pegs, inside a frame. Only half the deck fits in a season.

## Colours
Red + yellow = orange, yellow + blue = green, red + blue = purple. All three on one edge = **brown**.

## A season
1. Shuffle every cloth you still own into the basket. Draw 3. The basket's contents can be looked up; its
   order cannot.
2. On your turn, do one of these:
   - **Hang** a cloth on an empty peg, turned whichever way you like. Wherever it touches another cloth,
     **both touching edges take in the other cloth's colour**. Edges only ever gain colour.
   - **Set a cloth aside**: it leaves the game for good.
3. Draw 1. Repeat.
4. **Inspection** happens when the rack is full, when your hand runs out, or when you choose to **inspect
   now** (after at least one hang). Every rack cloth whose four edges match its tag **ships** and leaves the
   deck.
5. Everything else returns to the basket **with its colours**.

A cloth with a brown edge, or with more edges of a mix than its tag wants, is **spoiled**: it can never ship,
but it still dyes whatever it touches.

## End
After **3 seasons**, or when you have no cloths left. Ship **13** to win.

## Why these numbers
See the iteration 8 entry in `DESIGN_JOURNAL.md` and `sims/v8.log`.
