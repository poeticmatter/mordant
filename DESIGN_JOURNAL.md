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
