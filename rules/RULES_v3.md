# Mordant — Rules v3

Changes from v2 are marked **(v3)**.

## Components
- **Deck of 18 cloths.** 6 start dyed Red, 6 Yellow, 6 Blue (one dye unit each).
- **Dye memory.** Each cloth remembers the last 3 dye units that soaked into it,
  oldest first, drawn as stripes. A 4th unit pushes the oldest out.
- **Drying rack.** A 4 × 3 grid of pegs.
- **Order deck (45): stripe patterns**, read oldest → newest, aligned to the cloth's newest stripe.
  | Order | Example | Points | Copies |
  |---|---|---|---|
  | Full sequence | Blue · Yellow · Red | 4 | 1 of each of the 27 |
  | Ends with two stripes | any · Yellow · Red | 2 | 2 of each of the 9 |
- **(v3) Eight orders on display** — more than your cloths can ever fill.

## A season
1. Shuffle every cloth you still own into the draw pile. Draw 3.
2. **Hang** a cloth from your hand on any empty peg.
3. **Bleed:** the cloth you just hung adds its newest dye to every orthogonally adjacent cloth.
4. Draw 1. Repeat until the rack is full or your hand is empty.
5. **Inspection:** each order may take one matching cloth (best total assignment). Shipped cloths
   score and leave the game for good.
6. **(v3) Withdrawal:** an order still unfilled after its **second** inspection is withdrawn.
   Every empty display slot is refilled from the order deck.
7. Unshipped cloths keep their memory into the next season.

## End
After 4 seasons. Score = points shipped. **Target: TBD from simulation.**

## Why v3
With only 4 visible orders a strong player filled almost all of them (v1, v2). Here the 18 cloths
are the binding limit: each ships once, and every shipped cloth is one fewer cloth to dye others
with. The decision moves from "can I fill this?" to "which orders do I let go?".
