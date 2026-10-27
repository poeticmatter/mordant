# Selvedge — Rules v7 (playtest round 3)

v6 plus one move, asked for by the playtester: **set a cloth aside**.

## Components
- **18 cloths**: 6 Red, 6 Yellow, 6 Blue. A cloth's colour never changes.
- **Edges.** Each cloth has four edges (top, right, bottom, left), clean at the start.
- **Drying rack**: 4 × 3 pegs, inside a frame.
- **Pattern book**: 8 commissions dealt face up. Each wants a cloth of one colour with given stains on 2, 3
  or 4 of its edges (two with 2, three with 3, three with 4). Other sides: anything.

## A season
1. Shuffle every cloth you still own into the basket. Draw 3. The basket's contents are public, but its
   order is not.
2. On your turn, do one of these:
   - **Hang** a cloth on an empty peg. Wherever it touches another cloth, **both touching edges take the
     other cloth's colour**, covering any old stain. Edges against the frame or an empty peg are untouched.
   - **Set a cloth aside**: it leaves the game for good.
3. Draw 1. Repeat.
4. **Inspection** happens when the rack is full, when your hand runs out, or when you choose to
   **inspect now** (after at least one hang). Every rack cloth matching an open commission fills it and
   leaves (the best set of matches, one cloth per commission).
5. Unsold cloths return to the basket **with their stains**.

## End
Fill the whole book within **3 seasons** to win. The game also ends if you have no cloths left.

## Why these numbers
From simulation (`sims/v7.log`):
- Greedy completes the book 0.1 % of the time.
- The human-proxy completes it 1.1 % of the time.
- The Planner completes it 60 % of the time, setting aside about 4 cloths a game.
