# Selvedge — Rules v6 (playtest round 2)

A new game built after playtest 1. It keeps the pillars of Mordant (one deck, placement matters, cards with
memory, no combat) but replaces the hidden stripe queue with edges you can see.

## Components
- **18 cloths**: 6 Red, 6 Yellow, 6 Blue. A cloth's colour never changes.
- **Edges.** Each cloth has four edges (top, right, bottom, left), clean at the start.
- **Drying rack**: 4 × 3 pegs, inside a frame.
- **Pattern book**: 8 commissions dealt face up at the start. Each wants a cloth of one colour with
  given stains on 2, 3 or 4 of its edges (two with 2, three with 3, three with 4). Other sides: anything.

## A season
1. Shuffle every cloth you still own into the basket. Draw 3.
2. **Hang** a cloth on an empty peg. Wherever it touches another cloth, **both touching edges take the
   other cloth's colour**, covering any old stain. Edges against the frame or an empty peg are untouched.
3. Draw 1. Repeat.
4. **Inspection** happens when the rack is full, when your hand runs out, or when you choose to
   **inspect now** (after at least one hang). Every rack cloth matching an open commission fills it and
   leaves (the best set of matches, one cloth per commission).
5. Unsold cloths return to the basket **with their stains**.

## End
Fill the whole book within **3 seasons** to win. Otherwise the book is unfinished, and the end screen lists
what was left.

## Why these numbers
From simulation (`sims/v6*.log`): a one-move player (Greedy) never completes the book; a planning bot
completes it about 70 % of the time.
