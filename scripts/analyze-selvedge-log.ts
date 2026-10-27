// Replays exported Selvedge (v6+) logs; prints the book, each move with bot comparisons, and inspections.
import { readFileSync } from 'node:fs';
import { RULES_V6, RULES_V7 } from 'file:///C:/Code/SoloDeck/src/selvedge/config.ts';

const CONFIGS = { v6: RULES_V6, v7: RULES_V7 } as const;
import { applyMove, createGame, rackAfterHang, bestFill, openCommissions, moveSignature, type SelvedgeMove, type SelvedgeState, type HangMove } from 'file:///C:/Code/SoloDeck/src/selvedge/engine.ts';
import { commissionProgress } from 'file:///C:/Code/SoloDeck/src/selvedge/bots.ts';
import { createPlanner } from 'file:///C:/Code/SoloDeck/src/bots/planner.ts';
import { selvedgeAdapter } from 'file:///C:/Code/SoloDeck/src/sim/adapters/selvedge.ts';
import { Random } from 'file:///C:/Code/SoloDeck/src/engine/rng.ts';

const L = ['R', 'Y', 'B'];
const look = (c: { body: number; edges: (number | null)[] }) => `${L[c.body]}[${c.edges.map((e) => (e === null ? '.' : L[e])).join('')}]`;
const budget = Number(process.argv[3] ?? 800);
const planner = createPlanner(selvedgeAdapter, { rolloutBudget: budget });
const rng = new Random(11);

const games = readFileSync(process.argv[2], 'utf-8').split('# game').filter((t) => t.trim()).map((t) => {
  const lines = t.split('\n');
  const seed = Number(/seed=(\d+)/.exec(lines[0])![1]);
  const config = CONFIGS[/rules=(\w+)/.exec(lines[0])![1] as keyof typeof CONFIGS];
  const moves = lines.filter((l) => l.startsWith('m ')).map((l) => {
    const p = l.trim().split(' ');
    if (p[1] === 'a') return { move: { kind: 'setAside', clothId: Number(p[2]) } as SelvedgeMove, at: Number(p[3]) };
    return p[1] === 'i' ? { move: { kind: 'inspect' } as SelvedgeMove, at: Number(p[2]) } : { move: { kind: 'hang', clothId: Number(p[2]), cell: Number(p[3]) } as SelvedgeMove, at: Number(p[4]) };
  });
  return { seed, config, moves };
});

function fillNow(state: SelvedgeState, looks: ReturnType<typeof rackAfterHang>) {
  return bestFill(openCommissions(state), looks).filter((c) => c !== -1).length;
}
function proxyValue(state: SelvedgeState, looks: ReturnType<typeof rackAfterHang>) {
  const open = openCommissions(state);
  const partial = open.reduce((s, cm) => { const b = Math.max(0, ...looks.map((l) => (l ? commissionProgress(cm, l) : 0))); return s + (b === 1 ? 0 : b); }, 0);
  return fillNow(state, looks) + 0.5 * partial;
}
const onlyGame = process.argv[4] ? Number(process.argv[4]) : null;
games.forEach((game, gi) => {
  if (onlyGame !== null && gi !== onlyGame) return;
  let state = createGame(game.seed, game.config);
  console.log(`\n=== game ${gi + 1} seed ${game.seed}`);
  if (gi === 0) console.log('book: ' + state.commissions.map((c) => `#${c.id} ${look(c)}`).join('  '));
  let prev = 0;
  for (const { move, at } of game.moves) {
    const gap = (at - prev) / 1000; prev = at;
    const hangs = state.hand.flatMap((id) => state.rack.map((o, cell) => (o === null ? { kind: 'hang', clothId: id, cell } as HangMove : null)).filter((m): m is HangMove => m !== null));
    const fills = hangs.map((m) => fillNow(state, rackAfterHang(state, m)));
    const proxies = hangs.map((m) => proxyValue(state, rackAfterHang(state, m)));
    const decision = planner.decide(state, rng);
    const ranked = (decision.evaluations ?? []).slice().sort((a, b) => b.value - a.value);
    const sig = moveSignature(state, move);
    const rank = ranked.findIndex((e) => moveSignature(state, e.move) === sig);
    const pv = rank === -1 ? NaN : ranked[rank].value;
    const best = ranked[0];
    let desc: string;
    if (move.kind === 'hang') {
      const after = rackAfterHang(state, move);
      const f = fillNow(state, after);
      const pr = proxyValue(state, after);
      desc = `${look(state.cloths[move.clothId])}#${String(move.clothId).padStart(2)}->${String(move.cell).padStart(2)} => ${look(after[move.cell]!)} fill ${f}/${Math.max(...fills)} proxy ${pr >= Math.max(...proxies) - 1e-9 ? 'BEST' : 'no  '}`;
    } else if (move.kind === 'setAside') desc = `SET ASIDE ${look(state.cloths[move.clothId])}#${move.clothId}`.padEnd(52);
    else desc = `INSPECT (fill now ${fillNow(state, state.rack.map((id) => (id === null ? null : state.cloths[id])))} )`.padEnd(52);
    const hand = state.hand.map((id) => look(state.cloths[id])).join(' ');
    console.log(`s${state.season + 1} ${gap.toFixed(1).padStart(5)}s ${desc} | planner rank ${rank === -1 ? 'cut' : rank + 1}/${ranked.length} val ${pv.toFixed(2)} best ${best.value.toFixed(2)} ${moveSignature(state, best.move)} | hand ${hand}`);
    const before = state;
    state = applyMove(state, move);
    if (state.season !== before.season || state.isOver) {
      const filled = state.commissions.filter((c) => c.completedSeason === before.season);
      console.log(`   == inspection s${before.season + 1}: filled ${filled.map((c) => `#${c.id}${look(c)}`).join(' ')}  | total ${state.commissions.filter((c) => c.completedSeason !== null).length}`);
      const rackLooks = before.rack.map((id) => (id === null ? '   ....   ' : look(before.cloths[id]).padEnd(10)));
      if (move.kind === 'inspect') for (let y = 0; y < 3; y++) console.log('     ' + rackLooks.slice(y * 4, y * 4 + 4).join(' '));
    }
  }
});
