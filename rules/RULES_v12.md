# Selvedge — Rules v12 "Workshop puzzle" (playtest round 7)

A dye-workshop puzzle, scored like minigolf. Built to the playtester's direction.

## Pieces
- **4 blank cloths**, always at hand, each 12 units square.
- **Bench**: 36 × 36 units. A cloth's centre must lie on it.
- **4 objectives**, one per cloth, generated from the puzzle number.

## Play
- **Lay out** any cloths on the bench: positions snap to whole units, rotation to 15° steps. A cloth put down
  later lies on top. Cloths can be rearranged freely.
- **Spray** red, yellow or blue. Every cloth on the bench takes the dye wherever it isn't covered by a cloth
  above it, exactly to the covering cloth's edge. The dye covers whatever colour was there. Cloths off the
  bench are untouched.
- Each spray is a stroke. The puzzle is solved the moment every cloth meets its objective.
- **Start over** at any time (same puzzle, blank cloths, strokes back to 0).

## Objectives
Each objective is one or two **features**: a simple region in a colour (bare cloth counts as a colour).
- Regions:
  - half;
  - diagonal half;
  - quarter;
  - corner triangle;
  - centre square;
  - edge stripe (a third);
  - middle band (a third).
- A feature counts when at least **90 %** of its region shows its colour. The rest of the cloth can be
  anything.
- An objective's features keep their places relative to each other, but the whole objective may be turned
  or flipped any way.

## Score
Strokes against par. Par is the number of sprays in the game that generated the puzzle. In v12 that's
**3**: one spray of each dye. Every dye is asked for somewhere, so par is also the fewest sprays possible.

## How puzzles are made
See iteration 12 in `DESIGN_JOURNAL.md`: a semi-random game of one spray per dye, then a description of
what each cloth ended up including.
