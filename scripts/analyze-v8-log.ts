// Replays exported Selvedge v8+ logs: each move with its think time, what it did, and how the Planner ranked it.
// Usage: node scripts/analyze-v8-log.ts <log> [plannerBudget] [gameIndex]
import { readFileSync } from 'node:fs';
import { createPlanner } from '../src/bots/planner.ts';
import { Random } from '../src/engine/rng.ts';
import { tagsAdapter } from '../src/sim/adapters/tags.ts';
import { RULES_V8 } from '../src/selvedge/tags/config.ts';
import {
  applyMove,
  createGame,
  isSpoiled,
  legalMoves,
  moveSignature,
  rackAfterHang,
  shippingCells,
  type ClothLook,
  type HangMove,
  type TagsState,
} from '../src/selvedge/tags/engine.ts';
import { parseExportedMoves } from '../src/ui/gameLog.ts';

const CONFIGS = { v8: RULES_V8 } as const;
const MIX_LETTERS = ['', 'R', 'Y', 'O', 'B', 'P', 'G', 'n'];
const DYE_LETTERS = ['R', 'Y', 'B'];

const [logPath, budgetText = '800', onlyGameText] = process.argv.slice(2);
const planner = createPlanner(tagsAdapter, { rolloutBudget: Number(budgetText) });
const rng = new Random(11);

function describeLook(look: ClothLook): string {
  const edges = look.edges.map((mix) => MIX_LETTERS[mix]).join('');
  const tag = look.tag.map((mix) => MIX_LETTERS[mix]).join('');
  return `${DYE_LETTERS[look.body]}[${edges}]{${tag}}${isSpoiled(look) ? 'x' : ''}`;
}

function rackLooks(state: TagsState): (ClothLook | null)[] {
  return state.rack.map((clothId) => (clothId === null ? null : state.cloths[clothId]));
}

function spoiledCount(looks: readonly (ClothLook | null)[]): number {
  return looks.filter((look) => look !== null && isSpoiled(look)).length;
}

function describeHang(state: TagsState, move: HangMove): string {
  const hangs = legalMoves(state).filter((other): other is HangMove => other.kind === 'hang');
  const bestReady = Math.max(...hangs.map((other) => shippingCells(rackAfterHang(state, other)).length));
  const after = rackAfterHang(state, move);
  const newlySpoiled = spoiledCount(after) - spoiledCount(rackLooks(state)) - (isSpoiled(state.cloths[move.clothId]) ? 1 : 0);
  return `${describeLook(state.cloths[move.clothId])} -> peg ${move.cell} turn ${move.turns} => ${describeLook(after[move.cell]!)} ready ${shippingCells(after).length}/${bestReady} spoils ${newlySpoiled}`;
}

function printRack(state: TagsState): void {
  const width = state.config.rackWidth;
  const cells = rackLooks(state).map((look) => (look === null ? '....' : describeLook(look)).padEnd(22));
  for (let row = 0; row < state.config.rackHeight; row++) console.log('     ' + cells.slice(row * width, (row + 1) * width).join(' '));
}

const games = readFileSync(logPath, 'utf-8').split('# game').filter((text) => text.trim());
games.forEach((text, gameIndex) => {
  if (onlyGameText !== undefined && gameIndex !== Number(onlyGameText)) return;
  const header = text.split('\n')[0];
  const seed = Number(/seed=(\d+)/.exec(header)![1]);
  const config = CONFIGS[/rules=(\w+)/.exec(header)![1] as keyof typeof CONFIGS];
  if (!config) return;
  const times = text.split('\n').filter((line) => line.startsWith('m ')).map((line) => Number(line.trim().split(' ').at(-1)));
  const moves = parseExportedMoves(text);
  let state = createGame(seed, config);
  console.log(`\n=== game ${gameIndex + 1} seed ${seed} (${header.trim()})`);
  let previousAt = 0;
  moves.forEach((move, index) => {
    const thinkSeconds = (times[index] - previousAt) / 1000;
    previousAt = times[index];
    const ranked = (planner.decide(state, rng).evaluations ?? []).slice().sort((first, second) => second.value - first.value);
    const signature = moveSignature(state, move);
    const rank = ranked.findIndex((evaluation) => moveSignature(state, evaluation.move) === signature);
    const what =
      move.kind === 'hang'
        ? describeHang(state, move)
        : move.kind === 'setAside'
          ? `SET ASIDE ${describeLook(state.cloths[move.clothId])}`
          : `INSPECT with ${shippingCells(rackLooks(state)).length} ready`;
    const verdict = rank === -1 ? 'cut early' : `${rank + 1}/${ranked.length} (${ranked[rank].value.toFixed(2)} vs best ${ranked[0].value.toFixed(2)})`;
    console.log(`s${state.season + 1} ${thinkSeconds.toFixed(1).padStart(6)}s ${what.padEnd(78)} planner ${verdict}`);
    const before = state;
    state = applyMove(state, move);
    if (state.season !== before.season || state.isOver) {
      printRack(before);
      const shipped = state.cloths.filter((cloth) => cloth.shippedSeason === before.season);
      console.log(`   == inspection s${before.season + 1}: shipped ${shipped.length}, total ${state.cloths.filter((cloth) => cloth.shippedSeason !== null).length}`);
    }
  });
});
