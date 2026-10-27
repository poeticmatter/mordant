# Design Journal

Solo, single-deck, spatial card game with card memory. No combat.
Lead designer/engineer: Claude. Playtester: human.

---

## 0. Metrics (defined before any iteration)

Bots don't get bored, surprised or delighted. Every metric below is a proxy and
each one says what it is a proxy *for*, so I can tell when it stops serving that.

All metrics are computed by `npm run sim` from seeded games. "Score" is whatever
the current ruleset scores; "win" is reaching that ruleset's target.

| # | Metric | How it's measured | Target | Why this target |
|---|--------|-------------------|--------|-----------------|
| M1 | **Skill gradient** | Mean score and win rate for Random, Greedy, Planner on the same seeds | Random win ≤ 5 %; Greedy win 15–45 %; Planner win 50–85 %; Planner mean ≥ Greedy mean + 0.5 SD | If Random ≈ Planner, decisions don't matter. If Planner wins ~100 %, the target is too soft for a human who plays near Planner level. A gap measured in SDs is scale-free across rule versions. |
| M2 | **Skill headroom** | Planner with 4× budget vs Planner | Stronger planner still gains ≥ 0.2 SD | If more thinking stops helping, the game has a low skill ceiling and humans will "solve" it. |
| M3 | **Decision density** | Per Planner turn: is the 2nd-best move within δ of the best (δ = 0.25 × SD of Planner final scores, in expected-final-score units)? | 25–60 % of turns "close" | Too few close turns: obvious moves. Nearly all close: arbitrary moves (or the evaluation can't tell). |
| M4 | **Trivial turns** | Share of turns with ≤ 1 legal move or where every move evaluates within δ/4 | ≤ 15 % | Turns with no real choice are dead air. |
| M5 | **Memory ablation (decision)** | Planner that *cannot see* card memory (treats each card as its printed base state when evaluating) plays the real game | Score drops ≥ 0.5 SD vs full Planner | If a bot blind to memory plays as well, memory isn't driving decisions — it's decoration. |
| M6 | **Memory ablation (rules)** | Same seeds, rules with memory reset between cycles | Planner score changes ≥ 0.5 SD (either direction) and the *game* feels different (move distributions shift) | Checks whether memory changes the game at all, separately from whether bots need to track it. |
| M7 | **Placement ablation** | Planner chooses the card, the cell is random | Score drops ≥ 0.75 SD vs full Planner | WHERE a card goes must matter. Placement is the core verb, so it should be the biggest ablation. |
| M8 | **Strategic diversity** | Classify each Planner win by its dominant scoring approach (ruleset-specific features → label); report share of the most common label and normalized entropy | Top label ≤ 50 % of wins; normalized entropy ≥ 0.6 | One dominant line = a solved game. |
| M9 | **Tension arc** | Predict win/loss from progress at 50 % and 75 % of the game (logistic fit on score-so-far + simple state features), report AUC | AUC@50 % ≤ 0.80, AUC@75 % ≤ 0.92 | If the outcome is predictable halfway in, the back half is a formality. Some predictability late is healthy (good play should show). |
| M10 | **Run variety** | Mean pairwise distance between games' setup-driven feature vectors (what got scored, where, when), plus spread of Planner score across seeds | Mean pairwise distance ≥ 0.5 (0–1 scale); no seed archetype where Planner wins < 15 % or > 95 % more than 10 % of the time | Games should feel different, and difficulty variance should come from play, not the shuffle. |
| M11 | **Length & pacing** | Decisions per game, SD | 35–60 decisions (≈ 10–20 min at 15–20 s per decision), CV ≤ 20 % | Session target from the brief. |
| M12 | **Legibility load** | Mean number of cards whose visible state changes per move | 1–3 | A proxy for "can a human follow what just happened". Bots don't care; humans do. |

Metric caveats, written up front:
- M3/M4 depend on the Planner's own evaluation noise. Close values might be
  "genuinely close" or "Planner can't tell". I'll check by re-evaluating a sample
  of close turns with a much larger budget.
- M5 tests whether memory *matters for decisions*; it cannot tell whether a human
  finds memory interesting to think about. Only the playtest can.
- M8 labels are hand-defined per ruleset, so I could fool myself by picking labels
  that split nicely. I'll define them before seeing the distribution.

---

## 1. Seed concepts

### Concept A — "Guestbook" (social memory)
Cards are guests at an inn. Each night you seat guests on a grid of tables;
orthogonal neighbours converse. Every card remembers everyone it has ever sat
next to: strangers → acquaintances → friends → *tired of each other*. Guests
have hidden wishes (meet a certain house, know N people) revealed through
conversation. You run out of nights before you run out of guests.
- Memory: a full pairwise relationship matrix. Impossible on a table.
- Tension: combinatorial exhaustion of fresh pairings (a social-golfer problem).
- Risk: the human can't hold a 20×20 relationship matrix in their head, so the
  UI ends up doing the thinking (highlight "new acquaintance" cells) and the
  player follows highlights. Greedy "maximise new meetings" may be near-optimal.

### Concept B — "Mordant" (cards dye each other)
Cards are cloths in a dye house. Each cloth remembers the last three dyes that
soaked into it, oldest first. Hanging a wet cloth on the drying rack bleeds its
newest dye into its orthogonal neighbours, pushing their oldest dye out. A
cloth's colour is its memory: red+yellow is orange, three kinds is brown mud.
Merchants order colours; at the end of each season the rack is inspected,
matching cloths are shipped (they leave the deck for good), and the rest return
to the deck *still carrying their dye history* into the next season.
- Memory: an ordered FIFO of what each card has touched. Physically tedious,
  digitally trivial, and visible as colour.
- Spatial: who you hang next to whom, and in which order, decides every colour.
  Cards hung last are never repainted; cards hung first get overwritten.
- Tension: entropy. Every contact blends; mud is the default destination. Also a
  shrinking deck — shipping the good cloths leaves you the messy ones.
- Risk: could read as "colour-mixing puzzle" (familiar). Abstract FIFO might be
  hard to predict for humans.

### Concept C — "Wear" (cards change with use, hidden underlayers)
Each card is a lantern slide with several painted layers. Every time it is
played the top layer wears a little; after N plays it wears through and reveals
the hidden layer beneath, which nobody (including you) has seen. Where a card is
played sets the wear rate (bright cells wear fast, shaded cells slow) and some
cells project a card's image onto its neighbours. You are assembling a show: a
sequence of scenes that must be on the grid at certain times.
- Memory: play count and wear per card; hidden state revealed by use.
- Tension: push-your-luck on reveals, and timing.
- Risk: hidden layers = random rewards; the decision becomes "how fast do I
  gamble", and the projection rules feel bolted on. Hard to make legible.

### Choice: **B — Mordant**
- It satisfies every hard constraint with *one* rule (bleed). Memory, spatial
  placement, cards rewriting each other and cards evolving are the same act, not
  four bolted-on subsystems.
- Memory is legible: it *is* the card's colour, and the FIFO strip can be drawn
  as three stripes. Concept A's memory is invisible pairwise data.
- It has an obvious present-vs-future conflict (place for this season's orders
  vs. shape the cloth you'll draw next season), which is where skill gradients
  come from. Concept C's main decision is a gamble.
- Tension comes from entropy and a shrinking deck, not an opponent.
- The risk ("colour-mixing puzzle") is the thing to test first: if metrics say
  memory carry-over doesn't matter, it *is* just a colour puzzle and I'll know.

---

## Iteration log

### Infrastructure notes
- Engine: `src/engine/` (pure, seeded Mulberry32 RNG kept inside state; `applyMove` is pure,
  `applyMoveInPlace` exists only for simulation clones). Bots: `src/bots/`. Sim: `src/sim/`.
- Planner = flat Monte Carlo with successive halving over *distinct* moves (identical dye memory on
  the same peg counts once), epsilon-greedy rollouts (ε = 0.15) to game end, and determinization:
  every rollout reshuffles the hidden pile, the order deck and future shuffles, so the bot never
  sees hidden information. Common random numbers across candidates in a round.
- Memory-blind Planner: rebuilds its belief by resetting every cloth to its printed dye and replaying
  only this season's hangs (what a player who ignores carried history would know).
- Lesson (cost me one baseline run): workers load modules lazily, so editing `src/` mid-run crashed
  the sim. `npm run sim` now copies `src/` to `.sim-snapshots/<stamp>/` and runs from there.
- Metric change: M3/M4 count *distinct* moves only. Without that, two identical red cloths in hand
  produce "close" decisions that are really the same decision, inflating density.

### Iteration 1 — v1 baseline (shade orders)
Quick probe (16 Planner games, budget 200) before the full run:

| | Random | Greedy | Planner |
|---|---|---|---|
| mean ± SD | 14.3 ± 4.2 | 19.3 ± 4.8 | 30.1 ± 2.1 |
| win (≥ 20) | 12 % | 49 % | 100 % |

- The Planner fills ~15 of the 16 orders it can see over four seasons. The display (4 orders) caps
  the score, and a strong player nearly saturates it: **low ceiling, SD of 2, no tension**.
- Decision density 68 % close (above the 60 % ceiling) — with the Planner's SD this small, δ is only
  0.5 points, so "close" may just be "all good moves converge on the same capped score".
- Legibility: ~0.7 cloths visibly change shade per hang, 1.3 change memory. Comfortable.
- Diversity: Planner wins split deep 44 % / secondaries 56 %. Two archetypes, no more.

Verdict: the season puzzle is too easy *for a searcher* because colour (shade) is a lossy summary of
memory: many different histories read as "green". Memory matters only through a coarse lens.

**Full v1 baseline** (2000 Random/Greedy, 140 Planner, budget 400; `sims/v1-baseline.log`):

| Metric | Target | v1 | |
|---|---|---|---|
| M1 Random / Greedy / Planner mean | — | 13.8 / 19.2 / 29.9 (SD 2.5) | |
| M1 Planner over Greedy | ≥ 0.5 SD | 4.25 SD | ✅ (too big?) |
| M2 headroom (4× budget) | ≥ 0.2 SD | 0.24 SD | ⚠️ borderline: near ceiling |
| M3 close decisions | 25–60 % | 86 % | ❌ |
| M4 trivial turns | ≤ 15 % | 2.6 % | ✅ |
| M5 memory-blind drop | ≥ 0.5 SD | 3.59 SD | ✅ |
| M6 no-carry rules delta | ≥ 0.5 SD | 0.48 SD | ❌ |
| M7 random placement drop | ≥ 0.75 SD | 4.83 SD | ✅ |
| M8 top strategy share | ≤ 50 % | 62 % (2 labels) | ❌ |
| M9 AUC @50 % / @75 % | ≤ 0.80 / ≤ 0.92 | 0.90 / 0.96 | ❌ |
| M10 run variety | ≥ 0.5 | 0.39 | ❌ |
| M11 decisions | 35–60, CV ≤ 20 % | 40.5, 2 % | ✅ |
| M12 visible changes / move | 1–3 | 0.73 shade, 1.24 memory | ✅ (low end) |

The M5/M6 split is the most important finding so far. **Memory must be read, but it barely
creates value.** A Planner that ignores carried memory collapses (it mispredicts what every cloth
will bleed), yet a game where memory resets each season is nearly as good. Carried memory is
information to track, not an asset to build. That's a weak version of the brief: "cards with
memory must drive decisions" is technically true, but nobody *invests* in a cloth's history.

M3 at 86 % is probably the score cap again: with the Planner near the ceiling, most moves lead to
the same capped result, so they look "close". It's not evidence of rich choice.

### Iteration 2 — v2: stripe-pattern orders
**Hypothesis:** if orders ask for exact dye *sequences* (oldest → newest) instead of shades, the
order in which neighbours are hung — and the history a cloth carries in from last season — becomes
the thing you are solving. Expect: higher skill ceiling, wider Planner spread, larger memory ablations.

**Change:** 45 orders: all 27 three-stripe sequences (4 pts) and 9 "ends with X, Y" pairs (2 pts, ×2).
Everything else as v1. Rules: `rules/RULES_v2.md`.

Quick probe (14 Planner games, budget 400):

| | Random | Greedy | Planner |
|---|---|---|---|
| mean ± SD | 13.2 ± 6.5 | 19.1 ± 7.1 | 47.7 ± 3.4 |

- Gradient exploded: Planner is 8.6 Greedy-SDs above Greedy (v1: 5.0). Sequencing is where search
  pays off. Good sign for "decisions matter"; worrying sign for "a human can see it".
- Planner still near-saturates (≈ 13–14 of 16 orders) and its SD is still small.
- M8 labelling is now degenerate (every win is "sequence" because 27/45 orders are 4-pointers).
  The labels were fixed in advance, and this result says the order mix gives one dominant route.
**Full v2** (2000 cheap-bot games, 140 Planner; `sims/v2.log`):

| Metric | v1 | v2 |
|---|---|---|
| Random / Greedy / Planner | 13.8 / 19.2 / 29.9 | 13.1 / 19.4 / 46.4 (SD 4.2) |
| Planner over Greedy | 4.25 SD | 6.33 SD |
| M2 headroom | 0.24 SD | **0.03 SD** ❌ |
| M3 close | 86 % | 81 % ❌ |
| M5 memory-blind drop | 3.59 SD | 4.65 SD ✅ |
| M6 no-carry rules delta | 0.48 SD | **0.45 SD** ❌ |
| M7 random placement drop | 4.83 SD | 5.52 SD ✅ |
| M8 top strategy | 62 % | 98 % "sequence" ❌ |
| M10 variety | 0.39 | 0.76 ✅ |

Verdict: **keep the stripe orders** (variety and placement relevance up, and the stripes are the
most legible thing on screen), but they fix none of the real problems. Headroom is gone: the
Planner sits at a ceiling set by the 4-order display. M6 is unchanged: still nothing to invest in.

### Methodology change — human-proxy bot (requested by the human between iterations)
New bot in every report: looks one hang ahead, never at future seasons, sees **colour but not stripe
order** (a cloth "matches" a stripe order if the dyes line up in any order), and values partial progress
toward orders (a fully met order = its points, a partly met one = half its points × fraction met).
Rule I will hold myself to: **if a change widens the Planner's lead but the human-proxy doesn't gain
on Greedy, that's a warning, not a win.**

Diagnostic sibling: the same proxy but reading stripe order exactly ("reads order").

| mean | Greedy | Proxy (colour) | Proxy (reads order) |
|---|---|---|---|
| v2 | 19.4 | 16.8 (−0.35 SD) | 19.0 (−0.06 SD) |
| v3 probe | 35.9 | 31.1 (−0.59 SD) | 34.7 |

⚠️ **Standing warning.** No one-hang heuristic beats plain Greedy, even with exact order perception.
All the Planner's edge is multi-hang sequencing: hang the target first, bleed into it in stripe order,
then stop before something repaints it. Bots can't tell me whether a human sees that plan. That's
the first question the playtest must answer, and a reason to make sequencing *visible* in the UI
(the hang preview shows exactly which stripes land where).

Metric change: M9 (tension) now uses a **calibrated target** (the Planner's 35th-percentile score),
because against the placeholder target of 20 the Planner never lost and AUC was undefined.

### Iteration 3 — v3: oversupplied orders (suggested by the human)
**Hypothesis:** with clearly more orders than anyone can fill (8 shown, unfilled ones withdrawn after
two inspections), the cap moves from "orders visible" to "cloths owned" (18, each ships once). The
decision becomes which orders to abandon. Expect: more headroom, a wider Planner spread.

Probe (14 Planner games): Random 26.4, Greedy 35.9, Planner 56.0 ± 4.3. The Planner's lead over
Greedy roughly halved (8.6 → 4.2 SD), which is the direction we want: the game is less of a solved
puzzle for the searcher. Full run with ablations queued.

### Iteration 4 — v4: one stripe per season
**Hypothesis:** M6 says carried memory adds no value, because bleeds are abundant (≈ 15 stripe
additions per season against ≈ 4 shipments): any history can be rebuilt in-season. If a cloth soaks at
most **one stripe per season** (from the first neighbour hung beside it after it), a full three-stripe
order needs a cloth built *across seasons*. History becomes an investment, and the season puzzle
becomes "who touches whom first". Side effect: a soaked cloth is protected for the rest of the
season, which gives players a build-then-protect rhythm without a new rule.
**Change:** v3 + `soaksOncePerSeason`. UI marks soaked cloths.
**Prediction to falsify:** M6 (no-carry delta) jumps well above 0.5 SD. If it doesn't, the bottleneck
isn't bleed abundance.

Probe (14 Planner games): Random 23.4, Greedy 34.6, Proxy 29.2 / 34.8 (reads order), Planner 50.6 ± 4.0.

**Full v3** (`sims/v3.log`): Random 26.4 / Greedy 36.0 / Proxy 31.1 (reads order 34.9) / Planner 56.0 ± 3.9.
- **M6 no-carry delta 0.90 SD** (v2: 0.45). First time carried memory creates real value: with
  cloths as the binding resource, which cloths you keep, and what they carry, matters. ✅
- M5 memory-blind 4.08 SD, M7 random placement 5.19 SD. ✅
- M2 headroom 0.03 SD (x4 budget = same score). Third flat reading in a row. Caveat: this may be
  *my search's* plateau (flat MC with greedy rollouts) as much as the game's. I can't separate them
  without a different search algorithm, so I'm treating it as "suspicious", not "proven".
- M8: 100 % "sequence". The 4-point orders dominate every other way to score.
- Proxy still below Greedy (−0.60 SD colour, −0.14 SD reads order). ⚠️ warning stands.
Verdict: **keep** (M6 is the brief's core requirement and it finally moved).

**Full v4** (`sims/v4.log`, 100 Planner games):

| Metric | Target | v3 | v4 |
|---|---|---|---|
| Random / Greedy / Planner | — | 26.4 / 36.0 / 56.0 | 23.5 / 34.5 / 50.7 (SD 3.7) |
| Planner over Greedy | ≥ 0.5 SD | 5.28 | 4.45 ✅ |
| M2 headroom | ≥ 0.2 SD | 0.03 | **0.35** ✅ (first pass) |
| M3 close | 25–60 % | 73 % | 84 % ❌ |
| M4 trivial | ≤ 15 % | 2.6 % | 3.7 % ✅ |
| M5 memory-blind drop | ≥ 0.5 SD | 4.08 | 5.53 ✅ |
| M6 no-carry rules delta | ≥ 0.5 SD | 0.90 | **8.98** ✅ (Planner 50.7 → 17.7) |
| M7 random placement drop | ≥ 0.75 SD | 5.19 | 5.65 ✅ |
| M8 top strategy | ≤ 50 % | 100 % | 93 % ❌ |
| M9 AUC @50 % / @75 % (calibrated target 50) | ≤ .80 / ≤ .92 | — | **0.50 / 0.60** ✅ |
| M10 variety | ≥ 0.5 | 0.71 | 0.70 ✅ |
| Proxy colour / reads order vs Greedy | > 0 | −0.60 / −0.14 | −0.80 / +0.06 ⚠️ |

Prediction confirmed: M6 jumped by an order of magnitude. Memory is no longer something to track;
it is *the* asset. Each season writes exactly one line of each cloth's biography, so every hang is
a commitment about what a specific cloth becomes. Headroom appeared for the first time.
Tension: AUC ≈ 0.5 at the halfway mark is partly structural (three-stripe orders can't ship
before season 2, so early scores are low for everyone), but even at 75 % the outcome is open.
Verdict: **keep**. Remaining failures: M3 (too many "close" calls) and M8 (one route).

M3 caveat, now stronger: it may be measuring *functional equivalence* (on a 12-peg rack, several
pegs often give identical futures: same neighbours, same soaks) rather than agonising choices.
Signature dedup only removes identical cloths, not equivalent pegs. I'll check this by eye in the
playtest logs (hesitation time per decision) instead of trusting the number.

## Wild-idea protocol (triggered after v4 probe)
Plateau: M2 flat for 3 iterations, M8 degenerate since v2, M3 stuck at 73–86 %. And the honest
genre check: v2–v4 is starting to feel like "contract fulfilment with a colour puzzle". Stop tuning.
Five radically different directions:

1. **Merchants remember.** Each order is a merchant who remembers every cloth they bought and pays
   more for each repeat sale, but never buys the same stripes twice. Demand reacts to *your* history.
2. **The rack remembers (stained pegs).** Every peg keeps the last dye that soaked a cloth on it.
   A cloth hung there soaks the stain first. Position gains memory across seasons, so the board
   becomes a map of past decisions.
3. **Kinship bolts.** Cloths remember *who* they've shared dye with, not just which dye. New orders
   ask for a *bolt*: two cloths that have touched each other and end in the same stripes. Two-cloth
   orders are a different route from one-cloth sequences: fast and wide instead of slow and deep.
4. **(Absurd) The rack writes the orders.** At inspection, unsold cloths don't go back quietly: the
   merchants saw them, and next season's new orders are the stripes of what you failed to sell, shifted
   by one season. Your failures become your demand.
5. **Rinse peg / palimpsest.** One peg is a wash basin that strips the newest stripe. Memory can be
   rewound, and orders reward cloths that have *ever* held many stripes (a lifetime count, not current state).

**Prototype: #3 (kinship bolts).** It attacks the most stuck metric (M8: a second, structurally
different route to points). It uses a new memory type the brief names explicitly ("what they've
touched"), and it makes adjacency matter twice: for dye and for kinship. #4 is the runner-up; cheap
to try if #3 fails. #1 and #5 add rules without adding a second strategy.

### Iteration 5 — v5: kinship bolts (wild idea #3 prototyped)
**Hypothesis:** a second, structurally different scoring route (bolts: two kin cloths ending in the same
two stripes, 6 pts = 3/cloth, fillable from season 1) against slow sequences (4/cloth, season 2+)
breaks the single-strategy lock (M8) without weakening memory (M5/M6).
**Change:** v4 + lifelong kin memory per cloth + 9 bolt orders. `rules/RULES_v5.md`.

| Metric | Target | v4 | v5 |
|---|---|---|---|
| Random / Greedy / Planner | — | 23.5 / 34.5 / 50.7 | 23.5 / 35.2 / 51.1 (SD 3.6) |
| Planner over Greedy | ≥ 0.5 SD | 4.45 | 4.44 ✅ |
| M2 headroom | ≥ 0.2 SD | 0.35 | −0.03 ⚠️ |
| M3 close / M4 trivial | 25–60 % / ≤ 15 % | 84 % / 3.7 % | 79 % / 3.3 % |
| M5 / M6 / M7 | ≥ .5 / ≥ .5 / ≥ .75 SD | 5.53 / 8.98 / 5.65 | 5.99 / 8.53 / 5.52 ✅ |
| M8 top strategy (entropy) | ≤ 50 % (≥ 0.6) | 93 % (0.23) | **69 % (0.53)** ⚠️ improved |
| M9 AUC @50/@75 | ≤ .80 / ≤ .92 | 0.50 / 0.60 | 0.39 / 0.52 ✅ |
| M10 variety | ≥ 0.5 | 0.70 | 0.80 ✅ |
| M11 decisions | 35–60 | — | 38.7 (CV 7 %) ✅ |
| M12 visible changes / hang | 1–3 | — | 0.47 shade / 0.77 memory ⚠️ low |
| Proxy colour / reads order vs Greedy | > 0 | −0.80 / +0.06 | −0.91 / −0.47 ⚠️ |

Verdict: **keep, provisionally.** M8 moved for the first time since v1: 27 % of Planner wins are now
bolt-led. Memory metrics held. Two costs:
1. The human-proxy warning got *worse*. Neither proxy models kin at all, so this is partly by
   construction: bolts reward exactly the reasoning they lack. The real question is whether kinship is
   *legible* to a person. The UI now shows it (tap a hung cloth: its kin get a dashed outline and are
   named with their location), but that is unproven.
2. Headroom fell back to ~0, measured on only 34 games at 4× budget. I don't trust either reading
   much at this sample size.
v4 stays as the fallback if kinship turns out to be noise for humans.

M12 is now *below* its range: under soak-once, most hangs change zero or one cloth. For bots that's
neutral; for humans it may read as calm and readable, or as "nothing happened". That's a playtest question.

### "What is the one sentence that makes this game unlike anything else?"
- After v1 (honest answer): I couldn't give one. It was a colour-mixing contract game.
- Now: **"You don't build a deck — you write the biographies of eighteen cloths, one stripe per
  season, and the only pen you have is who you hang beside whom."**
  It holds up against the bots: memory *is* the score (no-carry ablation −8.5 SD), placement *is* the
  pen (random placement −5.5 SD). Whether it holds up for a person is untested.

### Where I suspect the numbers mislead
- **M3 (close decisions ~80 %)** likely counts functionally equivalent pegs as "close calls". A human
  won't agonise over two pegs with identical neighbours. Check: hesitation times in the logs.
- **The Planner/proxy gap** may overstate how hard the game is. The proxies can't do "hang A, then
  B beside it next turn", which is trivial for a person who has understood the soak rule. Or it may
  understate it, if the soak-once timing is hard to see. This is the main thing the playtest must answer.
- **Tension AUC ≈ 0.4–0.5 at mid-game** is partly structural: three-stripe orders can't ship before
  season 2, so mid-game score says little. "Uncertain" for a bot may feel like "nothing is happening
  yet" to a person for the first two seasons.
- **Bots don't feel the 8-order wall.** Eight orders is a lot of reading, especially on a phone.

## Playtest gate 1 (v5)
Stable enough on metrics that the remaining questions are human ones: legibility of stripes, soak
and kin; whether multi-hang sequencing is discoverable; pacing of seasons 1–2.
Built: playable UI (mobile portrait + PC; tap-to-preview, tap-again-to-hang; no hover anywhere),
rules sheet, seed display and seeded new games, deck view, kin highlighting, per-game logs with
millisecond timestamps, and "Copy log" export. Brief: `PLAYTEST_BRIEF.md`.
**Stopped here for the human playtester.**

---

## Playtest 1 debrief (v5, seed 345719, phone, final 42 / target 40)
Log replayed through the engine (`analysis: scratchpad analyze_log.ts`): 39 hangs, ~10 min on the rules
before the first hang, then **5.6 min of play** (median ~7 s per hang). Season scores 16 / 10 / 8 / 8.
Shipped 3 bolts, 2 sequences, 4 endings. **33 of 39 hangs were exactly Greedy's best move.**

What the player said (paraphrased) and what the log says:
| Topic | Player | Log / my reading |
|---|---|---|
| Strategy | "Fill orders that seemed simple, explore." Centre first to keep options open, then match the first hang to an order. Didn't change. | One-hang order matching = Greedy. It won without trying. |
| Clever moments | None. | Decision-density metric said ~80 % close calls. **M3 misled.** |
| Stuck | Last few hangs of a season felt cramped. | Last hangs have 1–4 distinct options; forced moves. |
| Tension | One moment: feared ruining a finished cloth; the soak-once rule saved it. | Entropy/protection is the only tension felt. |
| Memory | Didn't notice cloth names until the end-of-season report. Multi-stripe cloths: "find which order they could match". | Carried memory was read reactively, never invested in. **M6 (8.5 SD) didn't reach the human.** |
| Description | "A deck building game with spatial elements about dyeing cloths and filling orders." | No memory in the sentence. The one-sentence hook failed. |
| Bolts / kin | Happened by accident. Didn't know cloths could be tapped. | Kin was undiscoverable. |
| Orders | Picked the easiest. Didn't notice "last season" marks; no penalty, so didn't care. | Withdrawal (v3) created no felt pressure. |
| Win condition | Wasn't trying to win. Score attack isn't exciting as a win, worse as a loss. | Target irrelevant; won anyway. |
| Rules | Unintuitive: old dye deleted; dye spreads in every direction but lands at the bottom; soak-once only understood afterwards. | Three invisible-bookkeeping rules. |
| Legibility | "any" read as white. Rules screen doesn't reflow on mobile (can't zoom to see whole lines). Bit small on phone. | Bugs to fix regardless of design. |
| Pauses | Longest pause may have been distraction. | Remote timing is noisy; treat gaps as weak evidence. |
| Motivation | Could play again for feedback, but not motivated. | — |

### What I learned
1. **The bots' depth is not the player's depth.** Every memory metric passed because a 1,600-rollout searcher
   exploits stripe queues; a human with a one-hang heuristic scored *above* the target. The metrics measured the
   game the Planner plays, not the one the human plays.
2. **The invisible queue is the core problem**, not a tuning issue. FIFO deletion, hem-insertion and soak-once are
   bookkeeping rules with no physical intuition; the player can't predict them, so can't plan with them, so
   memory becomes something you *react* to.
3. **The ruin moment is the seed.** The only felt tension was "will this hang ruin my finished cloth?"
4. **Score attack is the wrong frame.** A goal you can lose in a specific, legible way is needed.

### Metric changes (effective immediately)
- **M13 Greedy ceiling (new):** plain Greedy must win ≤ 15 % against the target. If a one-move heuristic wins
  comfortably, the depth is decorative for humans whatever the Planner says. (v5: Greedy ≈ 25 % at target 40,
  and the human, playing Greedy-like, won.)
- **M3 is demoted** to a diagnostic. It counted near-equivalent options as agonising choices.
- **M14 Rules cost (new, judged by hand):** count rules a new player must hold in their head that have no
  visible effect on screen when they apply. Target: zero.

### Verdict
The pillars stay (one deck, placement matters, cards with memory, no combat). The representation of memory and
the goal structure go back to the wild-idea protocol.

## Wild-idea protocol, round 2 (after playtest 1)
Constraints from the debrief: memory must be *visible and physical* (no invisible queues); tension from
something you can lose in a legible way, not points; the ruin-and-protect moment is the seed; fewer rules,
each visible when it applies; a one-move player must not win comfortably.

1. **Selvedge: cloths stain each other where they touch.** Each cloth has a permanent body colour and four
   edges. Two cloths hung side by side stain each other's *touching edges* with their body colours, covering
   whatever was there. A cloth remembers who was beside it, on which side, and it shows: the edge *is* the
   memory. A cloth against the rack's frame keeps that edge untouched, so protecting finished work is
   spatial and visible ("hang it in the corner so its left edge stays red").
2. **Pattern book instead of score.** A fixed set of commissions dealt face up at the start (e.g. "a blue cloth
   with red top and bottom edges"). Complete the book within four seasons or the house fails. Every miss is
   named and visible; there's no points threshold.
3. **Sun and shade.** Pegs in the top row fade cloths each season, the bottom row stays damp and spreads dye
   further. Position over time is the memory, as wear.
4. **(Absurd) The rack is a loom.** Every hang weaves a thread into one shared tapestry that never clears;
   next season's cloths are dyed by the tapestry behind the peg they hang on. The table remembers, the cards
   inherit.
5. **(Absurd) Cloths gossip.** Each cloth whispers its body colour to its neighbours, who repeat it next
   season to *their* neighbours. Rumours travel the deck across seasons, and orders want a colour to have
   reached a particular cloth.

**Prototype: 1 + 2 together as v6**, plus one small rule aimed at the "cramped last hangs": you may **call the
inspection early**, leaving pegs empty (an empty peg stains nothing, so leaving a gap is a way to protect).
Why this pair: #1 makes every memory rule a visible, physical cause (touching edges stain; new dye covers old;
the frame protects), with zero bookkeeping. #2 replaces score attack with a book you can fail in a named way.
Planning across seasons becomes something a person can *see*: "this cloth already has red on top, so next
season it goes in a top corner." #3 adds rules without adding a decision; #4 and #5 are kept as fallbacks.

Risk check, the familiar-genre test: edge-coloured squares on a grid read like tile-laying (Carcassonne,
dominoes). The difference is that edges are not printed: they're *written by neighbours* and carried into
the next season. If the playtest description comes back as "a tile-matching game", that risk has landed.

Engineering: v6 is a different card model, so instead of more flags on the v5 engine the bots and sim become
generic over a `GameAdapter`, and v6 lives in its own engine module. v1–v5 stay runnable for comparison.

### Iteration 6 — v6 "Selvedge": edges stained by neighbours + pattern book
**Hypothesis:** if memory is *where a cloth was touched and by whom*, drawn on the cloth itself, and the goal
is a named checklist instead of a score, then (a) memory stays decision-relevant for the Planner, (b) a
human-like one-move heuristic does *better* than Greedy (because "get closer to the commission" is now a
sound heuristic), and (c) a plain Greedy player can't win.
**Change:** new engine (`src/selvedge/`), new rules (`rules/RULES_v6.md`). Bots and sim made generic over a
`GameAdapter` (v1–v5 results reproduce exactly after the refactor: v5 Random/Greedy 23.55/35.35 before and after).

Difficulty probe (21 Planner games each) to set the book:
| Book (fixed edges) | Seasons | Greedy done/win | Proxy done/win | Planner done/win |
|---|---|---|---|---|
| 6: [2,2,3,3,4,4] | 4 | 4.19 / 6 % | 4.82 / 22 % | 6.00 / 100 % |
| 8: [2,2,3,3,3,4,4,4] | 4 | 5.13 / 1 % | 5.88 / 6 % | 8.00 / 100 % |
| 6: [2,2,3,3,4,4] | 3 | 3.46 / 1 % | 4.07 / 6 % | 6.00 / 100 % |
| 6: [3,3,3,4,4,4] | 4 | 3.30 / 1 % | 4.24 / 10 % | 5.95 / 95 % |
| **8: [2,2,3,3,3,4,4,4]** | **3** | **4.15 / 0 %** | **4.90 / 0 %** | **7.71 / 71 %** |

**Full v6** (2000 cheap-bot games, 100 Planner; `sims/v6.log`), score = commissions filled of 8:

| Metric | Target | v5 | v6 |
|---|---|---|---|
| Random / Greedy / Proxy / Planner | — | (points) | 1.2 / 4.1 / 4.9 / 7.7 |
| M1 Planner win | 50–85 % | — | 71 % ✅ |
| M2 headroom (×4 budget) | ≥ 0.2 SD | −0.03 | 0.35 (85 % wins) ✅ |
| M13 Greedy win | ≤ 15 % | ~25 % | 0.1 % ✅ |
| Proxy over Greedy | > 0 | −0.91 SD | **+0.70 SD** ✅ |
| M4 trivial | ≤ 15 % | 3 % | 11 % ✅ |
| M5 memory-blind drop | ≥ 0.5 SD | 5.99 | 2.34 (wins 71 → 6 %) ✅ |
| M6 no-carry rules delta | ≥ 0.5 SD | 8.53 | 2.32 (wins 71 → 8 %) ✅ |
| M7 random placement drop | ≥ 0.75 SD | 5.52 | 10.18 ✅ |
| M8 top strategy / entropy | ≤ 50 % / ≥ 0.6 | 69 % / 0.53 | 72 % fresh / 0.86 ⚠️ |
| M9 AUC @50 / @75 | ≤ .80 / .92 | .39 / .52 | .57 / .70 ✅ |
| M10 variety | ≥ 0.5 | 0.80 | 0.99 ✅ (books are random per seed) |
| M11 decisions | 35–60 | 38.7 | 35.2 ✅ |
| M12 visible changes / hang | 1–3 | 0.47 | 1.23 ✅ |
| M14 invisible rules | 0 | 3 (FIFO, hem insert, soak-once) | 0 ✅ |

Verdict: **keep; take it to playtest 2.** Every hypothesis held. The most important line is "Proxy over
Greedy +0.70": for the first time the natural human heuristic is *better* than the mindless one, so the
game rewards how people actually think. Memory still matters a lot (losing it costs most wins) while being
drawn on the cloth.

Open worries, for the brief:
- A proxy-level player wins 0.4 % of books. First games will probably end unfinished. Whether that reads as
  "near miss, again" or "unfair" is a human question.
- M8: 72 % of filled commissions are "fresh" (made in one season). Carrying stains is the minority route,
  though it's what separates wins from losses (no-carry ablation costs most wins).
- M3 stays demoted (78 % "close"); it was wrong last time.

### "One sentence"
**"Every cloth wears the colours of whoever hung beside it — and keeps them."** The test for playtest 2 is
whether the player's own description mentions the edges remembering, or calls it tile-matching.

## Playtest gate 2 (v6)
UI rebuilt around the debrief: cloths drawn as frames (centre = colour, sides = stains); dashed sides mean
"any" (never a pale fill); rules are a normal scrolling page with 17px text (reflows and zooms on mobile)
and four rules, each with a visible effect; preview ticks show exactly which edges a hang will stain;
"Inspect now" in place of the cramped end-of-season; the end screen lists the unfilled commissions. Names,
kin and order withdrawal are gone. Logs use a new storage key (`selvedge.logs.v6`) and record early inspections.
**Stopped here for the human playtester.**

## Playtest 2 — log reading before the debrief (v6, seed 219766 ×3, thinking times accurate)
Logs: `playtests/round2-v6-seed219766.log`. Replayed with `scripts/analyze-v6-log.ts` (Planner budget 800
per move) and bots on the same seed with varied bot randomness.

| | Game 1 | Game 2 (replay) | Game 3 (replay) |
|---|---|---|---|
| Filled per season | 2 / 1 / 2 = **5** | 2 / 0 / 1 = **3** | 1 / 1 / 1 = **3** |
| Play time (first hang → end) | 6 min | 4 min | 7 min |
| Planner continuing from their season-2 start | 4/4 wins | 4/4 wins | 4/4 wins |
| Planner continuing from their season-3 start | 0/4, mean 7 | 0/4, mean 6.5 | 0/4, mean 6 |

The seed is typical: Planner from scratch 14/24 wins (mean 7.6), Greedy mean 3.8, proxy mean 4.4, neither
ever wins. Five of the eight commissions want a red cloth (six reds in the deck).

What the logs say before I ask anything:
- **Season 1 was never the problem.** From every one of their season-2 positions the Planner still wins every
  time. The games were lost in season 2, when cloths arrive already stained: 1, 0 and 1 commissions filled.
- **Replays got worse, not better** (5 → 3 → 3), even though game 3 had the most thinking (pauses of
  28–68 s in seasons 2–3). Playing the same seed again didn't teach them what went wrong.
- **Long pauses sit at season starts** (36–43 s before the first hang of season 2, every game): reading a
  hand of pre-stained cloths. That's the memory being read, and it's slow.
- **Game 2, season 2: "inspect now" with nothing that would fill.** Then season 3 ended after 5 hangs with
  cloths still in hand. Looks like giving up, or a misunderstanding of what inspection does. Ask.
- **Game 3, season 3: inspect 0.8 s after the last hang**, one peg empty. Possibly a mis-tap. Ask.
- Several hangs passed up an immediate second fill ("fill 1 of a possible 2"), mostly in game 3.
- Game length 4–7 min is below the 10–20 min target, but two of the games were effectively abandoned.

### Debrief 2, first answers
- **Cross-season planning is real and intended.** Game 3: "get the red cloths partially dyed so I can get
  more of them done later", and placing cloths "where they would be good after other cloths show up". That's
  the carry mechanic being played on purpose, which round 1 never got.
- **An emergent strategy insight, unprompted:** "way too many blue cloths… I only need one", and next time
  "not fulfill any red cloth patterns in the first season to avoid diluting the red in my deck". Red is both
  the body five commissions want and a stain six of them need, so every red shipped is a red stain source
  lost. That is a real tension in this book, and the player found it in three games.
- **"I didn't remember exactly which cloths were in my deck and how they were painted."** The memory lives
  on cards they can't see between seasons. The planning was sound (the Planner wins 4/4 from their season-2
  start in game 3); what failed was executing it in season 2 without knowing what was coming.
  ("It backfired" is the player's read; the log says the setup was fine and the follow-through wasn't.)
- **"Ruined a ready cloth" — confirmed in the log.** Game 2, season 2, 3rd hang (21 s think): a red cloth on
  peg 7 restained the top of the cloth on peg 11, which had just become an exact match for a commission.
  Fill went 1 → 0, and the season ended with nothing. The preview marks changed edges, but not "this breaks
  a match".
- **The early inspections were giving up, "frustration (in a good way!)".** Losing was legible early enough
  to quit, and they wanted the next game. Three games played voluntarily; round 1 was "not very motivated".

### Debrief 2, second answers
- **The ruined cloth was a double tap**, not a misread. "Tap the peg again to hang" turns a double tap into
  a hang. That's a UI bug, not a rules problem, so I withdraw the "warn when a hang breaks a ready match" idea.
- **Never looked for the basket contents:** "I assumed the information was not available and part of the
  game was to deal with what I am dealt." The basket count opens a full list, but a number with "in
  basket" under it doesn't read as a button. So the memory was legible in principle and invisible in
  practice: the same failure as round 1's names, one layer down.
- **The player wants to shape the deck:** "discard blue cloths, probably as soon as I dyed all the blue
  edges I needed." Their round-1 description already called it "a deck building game". The urge is
  specific and timed, so it's a real decision: a cloth is worth keeping exactly as long as its colour is
  still needed as a stain somewhere.
- **One sentence: "A spatial puzzle about dying cloths."** Not "tile-matching", which was the risk. But
  the edges remembering didn't make it in either.
- **Length:** they had the time but were ill: "my brain isn't handling the puzzle". They want to play again.
  The cognitive load is high. Showing the basket should lower it, since nothing will need remembering.

### What changes (iteration 7)
1. **Hanging needs the "Hang it" button.** A second tap on the previewed peg no longer hangs.
2. **The basket is shown on the board,** as small tiles under the hand, sorted by colour (the draw order
   stays hidden). The memory you plan around is in view instead of behind a tap.
3. **Rule prototype: set a cloth aside.** Instead of hanging, retire a cloth from your hand for good and draw
   a replacement. Hypotheses:
   - it becomes a real decision (the Planner uses it, but not every turn);
   - the player's own heuristic ("drop a colour once its stain work is done") beats Greedy;
   - Greedy still can't win;
   - carried stains still matter.

   Kept only if the sims say so; otherwise v6 rules stay and only fixes 1–2 ship.

### Iteration 7 — v7: set a cloth aside (from the debrief)
**Change.** Instead of hanging, you may set a cloth in hand aside for good and draw another. The game ends
early if you run out of cloths.

The UI changes ship either way:
- the "Hang it" button is the only way to hang;
- the basket is shown on the board, sorted by colour.

**Bots.** Greedy never sets aside, since it has no immediate value. The human-proxy uses the playtester's
rule: set aside a cloth whose colour no open commission still needs as a body or a missing stain, unless a
hang fills more now. I also probed count-based rules ("keep 1/2/3 of a colour nobody wants as a body"):
- 1,000 games each, mean 4.88–4.95, 0.8–1.2 % wins;
- the same as the colour rule within noise.

| Metric | Target | v6 | v7 |
|---|---|---|---|
| Planner wins / mean | 55–80 % | 71 % / 7.69 | 60 % / 7.60 ✅ |
| Planner ×4 wins | > Planner | 85 % | 68 % ✅ |
| Proxy over Greedy | > 0 | +0.70 SD | +0.74 SD ✅ |
| Planner over proxy | (gap; wider is a warning) | 5.56 SD | 5.33 SD ✅ narrower |
| M13 Greedy / proxy wins | ≤ 15 % | 0.1 % / 0.4 % | 0.1 % / 1.1 % ✅ |
| M5 memory-blind drop | ≥ 0.5 SD | 2.34 (6 % wins) | 2.76 (3 % wins) ✅ |
| M6 no-carry delta | ≥ 0.5 SD | 2.32 (8 % wins) | 2.27 (7 % wins) ✅ |
| M7 random placement | ≥ 1 SD | 10.2 | 9.9 ✅ |
| M4 trivial turns | ≤ 20 % | 10.6 % | 6.6 % ✅ |
| M8 top strategy / entropy | ≤ 50 % / ≥ 0.6 | 72 % fresh / 0.86 | 63 % fresh / 0.95 ⚠️ better |
| M9 tension AUC @50 / @75 (target: full book) | ≤ .80 / .92 | .57 / .70 | .52 / .59 ✅ |
| M11 decisions | 35–60 | 35.2 | 33.9 ~ |
| M12 visible changes / move | 1–3 | 1.23 | 0.99 ~ (set-asides change nothing on the rack) |

The Planner sets aside 4.35 cloths a game: 4.05 in wins and 4.8 in losses.

**Reading.** Setting aside doesn't make the game easier for any bot. The Planner does slightly worse with
it. Part of that is search noise: its rollouts sometimes throw away cloths at random. But it also uses the
move a lot and does worse when it uses it more, which is what a real temptation looks like.

Carried stains matter more, not less. With fewer cloths, the ones you keep are drawn more often, so their
stains get reused: carried fills rise from 28 % to 37 %.

The human-proxy gains a little, so the strong-to-human gap narrows: the opposite of the warning case.

Two caveats:
- The bots can't measure what the playtester actually asked for, which is agency over the deck and
  fewer cloths to keep track of.
- M9 printed null. Every Planner game scored 7 or 8, so the calibrated target (35th percentile) was 7. At
  that target there are no "losses" to rank, and the AUC is undefined. I recomputed it against the real
  goal, a full book (shown in the table). The outcome is less predictable from the halfway score than in
  v6: more tension. `calibratedTarget` now moves up to the next score when no game falls
  short of the percentile (with a test).

**Verdict: keep, and put it to the player.** No metric got worse beyond noise, diversity improved, and
it's the playtester's own idea, so their reaction is the real test.

### Playtest 3, game 1 — log reading (v7, seed 339185, final 6)
The playtester's best score so far, on a new seed, in 9.7 minutes. Replayed with
`scripts/analyze-selvedge-log.ts` (Planner budget 800).

| Season | Fills | Moves | Notes |
|---|---|---|---|
| 1 | 2 | 12 hangs | 107 s on the first move (reading the board). |
| 2 | 2 | 7 hangs, 5 set-asides | 88 s on the first hang, which the Planner ranks 37th of 39. |
| 3 | 2 | 6 hangs | Every hang took 10–37 s; the slowest season. |

Observations:
- **Set-asides.** Five, all in season 2, and all of plain cloths (no stains yet). The playtester
  only dropped cloths with no history, never one that carried stains. One took 52 s, the longest
  pause after the season openers.
- **The Planner disagrees on timing.** It never ranks a set-aside first. Its best moves at those
  points were hangs.
- **The ending.** The last hang of season 3 filled 2 where another peg would have filled 3, and the
  Planner's value there was 6.9: a 7 was in reach. The inspection came 4 s later.
- **Early inspection.** Season 2 ended by choice with three cloths still in hand.

**Meta-feedback from the playtester**, kept as a standing rule (see memory): their answers are
playtester feedback, not design direction; ask about feelings, since the bots can't; always close
with an open request for anything else.

**Unprompted remark:** it felt odd that orientation matters on a square cloth. This is a fiction
mismatch: the cloth looks turnable but the rules say it isn't. It's an M14 (invisible rule) problem
even though the rules page states it. Candidate for v8: a commission accepts a cloth in any turn
(or turn and flip). That would make fills much easier, so it would need re-tuning; to be simmed.

### Debrief 3 — answers
1. **Compared with round 2:** less constrained, possibly because this book never needed one colour
   badly. *Overwhelmed* by seeing everything in the deck. In season 3 the draw order didn't
   matter: there was room to plan every cloth's position in advance, "and I don't want to do that".
2. **Setting aside:** worried it would leave too few cloths. Decided to wing it rather than calculate.
3. **Season 3:** the same overwhelm, for the same reason.
4. **Anything else:**
   - Once a player figures it out, will there be a reason to come back?
   - The colour bleed doesn't feel right: real dyes would *mix*, not swap.
   - They like the theme, but it isn't coming through enough.
   - Orientation shouldn't matter on a square cloth.
   - **Constraint breach:** "only a deck" meant *everything* in the deck. The pattern book sits
     outside it, so v6/v7 break the brief. The deck should remember, visibly, and hold everything.
   - "Already a pretty decent game."

**Reading.**
- *Full information is the problem, not a fix.* In round 2 the basket was hidden in practice and the
  player read and adapted. In round 3 it was on the board, and late seasons became a solvable layout
  puzzle (≈10 cloths left, 12 pegs). Solving it felt like homework. The fun is in reading what comes
  and adapting, not in exhaustive planning. This is invisible to the bots, which love full information.
- *Set-aside was a gamble, not a calculation.* That's fine; a gamble is a feeling. But it worked by
  removing plain cloths, which is housekeeping.
- *The theme fights the rules.* Swapping colours and fixed orientation both read as arbitrary
  ("why?"), and every "why?" spends attention on rules instead of the cloth.
- *The pattern book is outside the deck.* That's a hard constraint, so this is a redesign, not a tweak.

### What changes (v8, "tagged cloths")
1. **Each cloth carries its own order.** A tag on the cloth names the edges its customer wants:
   "two orange edges", "one green and one purple". No pattern book; the deck is everything. A cloth
   ships at inspection once its tag is met, and leaves the deck. Your orders are also your dyers, so
   every success thins the dyes you have left.
2. **Dyes mix.** Every edge starts as the cloth's own colour. Touching a cloth of another colour mixes
   that colour into the facing edge, on both cloths: red beside blue gives two purple edges. A third
   primary on the same edge makes it **brown**, and a cloth with a brown edge can never ship. Brown
   entropy becomes the risk you manage, not a drift. Edges only gain colour, so a cloth's frame is its
   whole history.
3. **Turn the cloth.** You choose its orientation as you hang it. Tags don't care which side is which,
   only how many edges of each colour.
4. **Less on the board.** The basket goes back behind a clearly labelled button. The board shows the
   rack and your hand; tags are on the cloths themselves.
5. **Rack size gets tuned so room is scarce in every season,** so late seasons stay about adapting
   to the draw.

Kept: three seasons, hand of 3, early inspection, setting aside (if the sims don't say otherwise).

### Iteration 8 — v8: tagged cloths, mixing dyes, turning (from debrief 3)
New engine in `src/selvedge/tags/`. The v6/v7 engine stays for the sims and old logs. The shared rack
geometry moved to `src/selvedge/grid.ts`.

**Probe 1: what a tag asks for.** My first version asked for *at least* the listed mixed edges (other edges
free). Far too easy on 4 × 3: Greedy shipped 14.4 of 18 and the Planner 18/18 in every game. Then I tried
**exact tags**: the tag names all four edges, with the rest plain, so over-dyeing spoils the order. That made
spatial placement bite in both directions: you need some neighbours and must avoid others. Greedy fell to 8.3
and the Planner to 14.3. Exact tags are now the only rule.

**Probe 2: the human-proxy.** With only "one hang ahead, avoid spoiling", the proxy was no better than
Greedy (8.4 vs 8.3), which is the warning sign. Adding one obvious human rule, *inspect rather than make a
hang that leaves fewer cloths ready*, lifted it to 11.0. Most of the skill is reachable by simple, sensible
rules.

**Probe 3: rack size and turning** (1,000 games for heuristics, 14–28 for the Planner):

| Variant | Greedy | Proxy | Planner |
|---|---|---|---|
| 4 × 3, turning | 8.3 | 11.0 | 14.3 |
| 4 × 3, no turning | 8.0 | 12.1 | 13.5 |
| 3 × 3, turning | 7.3 | 11.5 | 13.7 |
| 3 × 3, no turning | 7.0 | 11.1 | 13.5 |

On 4 × 3, turning helped only the Planner and *hurt* the proxy, which is the warning case. On 3 × 3 it helps
the proxy and barely changes the Planner. **3 × 3 with turning**: half the deck fits per season, so the draw
matters every season. That answers "in season 3 you can fully plan everything".

**Probe 4: does memory still matter?** The first full run (tags 1,2,2,2,3,3; target 14) is in
`sims/v8-small-tags.log`. Gradient, density and wins all passed:
- Greedy 7.2, proxy 11.4, Planner 13.7;
- wins 0.1 % / 10 % / 58 %;
- trivial turns 1 %;
- Planner over proxy 1.5 SD, against 5.3 in v7.

**But M6 failed: −0.18 SD.** Washing every edge between seasons didn't hurt the Planner. It shipped about
5 cloths a season from 9 pegs, finishing most tags within a single season, so carried colour was only a
liability. (M8 read 100 % "fresh" because it labels each winning game by its majority shipment type. In
fact 24 % of shipments used carried colour, but none needed it.)

Bigger tags make tags span seasons:

| Tag sizes | Greedy (wash) | Proxy (wash) | Planner (wash) | Carried share (Planner) |
|---|---|---|---|---|
| 1,2,2,2,3,3 | 7.3 (8.3) | 11.5 (11.2) | 13.7 (13.7) | 24 % |
| 2,2,3,3,3,4 | 6.3 (5.8) | 10.3 (8.5) | 12.6 (11.9) | 42 % |
| 2,3,3,3,4,4 | 5.2 (4.1) | 9.1 (6.6) | — | 48 % (proxy 53 %) |

**Chosen: 2,2,3,3,3,4.** Carry pays for every bot, the proxy most of all (+1.8 ships), so
keeping track of what a cloth already has is a human skill, not just a Planner one.

**Full run** (`sims/v8.log`; 2,000 games per heuristic, 60 Planner games, budget 400). Wins are at target
13, recomputed from the records: the run itself used a target of 12, at which the proxy won 24 %. Too easy
for a one-move player, so the target moved to 13.

| Metric | Target | v7 | v8 |
|---|---|---|---|
| Random / Greedy / proxy / Planner (mean ships of 18) | — | — | 1.9 / 6.3 / 10.3 / 12.8 |
| Planner wins | 55–80 % | 60 % | 65 % ✅ |
| Planner ×4 | > Planner | 68 % | mean 13.75; headroom +0.73 SD ✅ |
| Proxy over Greedy | > 0 | +0.74 SD | **+2.04 SD** ✅ |
| Planner over proxy (wider is a warning) | — | 5.33 SD | **1.58 SD** ✅ |
| M13 Greedy / proxy wins | ≤ 15 % | 0.1 % / 1.1 % | ≈0 % / ≈9 % ✅ |
| M5 memory-blind drop | ≥ 0.5 SD | 2.76 | 2.94 ✅ |
| M6 no-carry delta | ≥ 0.5 SD | 2.27 | 0.89 ✅ (small tags: −0.18 ❌) |
| M7 random placement | ≥ 1 SD | 9.9 | 6.1 ✅ |
| M4 trivial turns | ≤ 20 % | 6.6 % | 0.9 % ✅ |
| M8 top label / entropy | ≤ 50 % / ≥ 0.6 | 63 % / 0.95 | 85 % fresh / 0.61 ⚠️ |
| M9 tension AUC @50 / @75 | ≤ .80 / .92 | .52 / .59 | .75 / .67 ✅ |
| M10 variety | high | — | 0.71 |
| M11 decisions | 35–60 | 33.9 | 26.4 ⚠️ short |
| M12 visible changes / move | 1–3 | 0.99 | 0.81 ⚠️ |

**Reading.**
- The strong-to-human gap fell from 5.3 SD to 1.6 SD, and simple human rules are worth 2 SD over Greedy:
  the depth is now mostly within reach.
- Memory matters both ways. Forgetting carried colour costs 2.9 SD (it's what spoils cloths). Carrying it
  is worth +0.9 SD (it's what finishes big tags).
- Two weaker spots:
  - M8: most winning games are still mostly fresh shipments.
  - M11: games are short, 26 decisions. Pacing in minutes is the thing to check with the player; their
    v7 game took ~30 s per decision late on, which would make about 12 minutes.
- What the bots can't tell: whether mixing *feels* like dye, whether exact four-edge tags are readable
  at a glance, and whether turning is a pleasure or a chore.

**Verdict: ship v8 to playtest round 4.**
