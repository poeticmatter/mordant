# Mordant — Rules v2

Changes from v1 are marked **(v2)**.

## Components
- **Deck of 18 cloths.** 6 start dyed Red, 6 Yellow, 6 Blue (one dye unit each).
- **Dye memory.** Each cloth remembers the last 3 dye units that soaked into it,
  oldest first, drawn as stripes. A 4th unit pushes the oldest out.
- **Drying rack.** A 4 × 3 grid of pegs.
- **(v2) Order deck (45): stripe patterns.** Orders no longer ask for a colour; they
  ask for a *sequence*, read oldest → newest and lined up with the cloth's newest stripe.
  | Order | Example | Points | Copies |
  |---|---|---|---|
  | Full sequence | Blue · Yellow · Red | 4 | 1 of each of the 27 sequences |
  | Ends with two stripes | any · Yellow · Red | 2 | 2 of each of the 9 pairs |

## A season
1. Shuffle every cloth you still own into the draw pile. Draw 3.
2. **Hang** a cloth from your hand on any empty peg.
3. **Bleed:** the cloth you just hung adds its *newest* dye to the memory of every
   orthogonally adjacent cloth (pushing out their oldest dye if full). The wet cloth is unchanged.
4. Draw 1 (if the pile isn't empty). Repeat until the rack is full or your hand is empty.
5. **Inspection:** each face-up order may take one matching cloth from the rack
   (best total assignment). Shipped cloths score and leave the game. Fulfilled orders
   are replaced; unfulfilled ones stay.
6. Unshipped cloths keep their memory into the next season.

## End
After 4 seasons. Score = points shipped. **Target: TBD from simulation.**
