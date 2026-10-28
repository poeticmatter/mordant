import { useState } from 'react';

interface MenuSheetProps {
  seed: number;
  /** The playtest log as pasteable text. */
  exportText: string;
  finishedCount: number;
  /** A second shortcut beside Rules (the deck, for games that have one). */
  deckShortcut?: { label: string; onOpen: () => void };
  onNewGame: (seed?: number) => void;
  onOpenRules: () => void;
  onClose: () => void;
}

type CopyStatus = 'idle' | 'copied' | 'manual';

export function MenuSheet({ seed, exportText, finishedCount, deckShortcut, onNewGame, onOpenRules, onClose }: MenuSheetProps) {
  const [seedText, setSeedText] = useState('');
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

  async function copyLog() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyStatus('copied');
    } catch (error) {
      console.warn('Clipboard write failed; showing the log for manual copy.', error);
      setCopyStatus('manual');
    }
  }

  const parsedSeed = Number.parseInt(seedText, 10);
  const hasValidSeed = Number.isInteger(parsedSeed) && parsedSeed >= 0;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-deep/80 sm:items-center" role="dialog" aria-modal aria-labelledby="menu-title">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-lg bg-slate p-4 sm:rounded-lg">
        <div className="flex items-baseline justify-between">
          <h2 id="menu-title" className="text-xl font-extrabold">Menu</h2>
          <span className="text-sm text-chalk-soft">Seed {seed}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onOpenRules} className="rounded-sm bg-slate-raised py-3 font-semibold">Rules</button>
          {deckShortcut && (
            <button type="button" onClick={deckShortcut.onOpen} className="rounded-sm bg-slate-raised py-3 font-semibold">
              {deckShortcut.label}
            </button>
          )}
        </div>

        <h3 className="mt-6 font-semibold">Playtest log</h3>
        <p className="mt-1 text-sm text-chalk-soft">
          {finishedCount} finished {finishedCount === 1 ? 'game' : 'games'} saved in this browser, plus the one in progress.
        </p>
        <button type="button" onClick={copyLog} className="mt-2 w-full rounded-sm bg-weld py-3 font-semibold text-slate-deep">
          {copyStatus === 'copied' ? 'Log copied' : 'Copy log to clipboard'}
        </button>
        {copyStatus === 'manual' && (
          <textarea
            readOnly
            value={exportText}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-2 h-32 w-full rounded-sm bg-slate-deep p-2 text-xs text-chalk"
            aria-label="Game log to copy"
          />
        )}

        <h3 className="mt-6 font-semibold">New game</h3>
        <div className="mt-2 flex gap-2">
          <input
            inputMode="numeric"
            placeholder="Seed (optional)"
            value={seedText}
            onChange={(event) => setSeedText(event.target.value.replace(/\D/g, ''))}
            className="min-w-0 flex-1 rounded-sm bg-slate-deep px-3 py-2 text-chalk placeholder:text-chalk-soft"
            aria-label="Seed for the new game"
          />
          <button
            type="button"
            onClick={() => onNewGame(hasValidSeed ? parsedSeed : undefined)}
            className="rounded-sm bg-slate-raised px-4 py-2 font-semibold"
          >
            {hasValidSeed ? 'Start this seed' : 'Start random'}
          </button>
        </div>
        <p className="mt-1 text-xs text-chalk-soft">The current game is kept in the log as unfinished.</p>

        <button type="button" onClick={onClose} className="mt-6 w-full rounded-sm border border-slate-line py-3">
          Close
        </button>
      </div>
    </div>
  );
}
