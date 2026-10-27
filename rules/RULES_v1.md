# Mordant — Rules v1

## Components
- **Deck of 18 cloths.** 6 start dyed Red, 6 Yellow, 6 Blue (one dye unit each).
- **Dye memory.** Each cloth remembers the last 3 dye units that soaked into it,
  oldest first. A 4th unit pushes the oldest out.
- **Drying rack.** A 4 × 3 grid of pegs.
- **Order deck (24).** Each order asks for a hue:
  | Order | Matches a cloth whose memory holds… | Points | Copies |
  |---|---|---|---|
  | Red / Yellow / Blue | only that dye (any amount) | 1 | 2 each |
  | Deep Red / Yellow / Blue | exactly 3 units of that dye | 3 | 2 each |
  | Orange / Green / Purple | exactly those two dyes | 2 | 3 each |
  | Brown | all three dyes | 2 | 3 |

## Hue of a cloth
- One kind of dye → that primary. Three units of it → *deep*.
- Two kinds → the secondary (R+Y orange, Y+B green, R+B purple), whatever the ratio.
- Three kinds → brown.

## Setup
Shuffle the cloths into a draw pile and the orders into an order deck. Reveal 4 orders.

## A season
1. Shuffle every cloth you still own into the draw pile. Draw 3.
2. **Hang** a cloth from your hand on any empty peg.
3. **Bleed:** the cloth you just hung adds its *newest* dye unit to the memory of
   every orthogonally adjacent cloth (pushing out their oldest unit if full).
   The wet cloth itself is not changed.
4. Draw 1 (if the pile isn't empty). Repeat from 2 until the rack is full or your hand is empty.
5. **Inspection:** each face-up order may take one matching cloth from the rack.
   Matched cloths are shipped: you score the order and the cloth leaves the game.
   Fulfilled orders are replaced from the order deck; unfulfilled ones stay.
6. Every unshipped cloth (rack, hand, pile) keeps its dye memory into the next season.

## End
After 4 seasons. Score = points from shipped orders. **Target: TBD from simulation.**

## Notes
- v1 ships automatically with a points-maximising assignment.
