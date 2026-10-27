// Runs the simulator from a frozen copy of src/, so long runs keep their rules
// even while the source is being edited (workers load modules lazily from disk).
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const snapshotDir = join('.sim-snapshots', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(snapshotDir, { recursive: true });
cpSync('src', join(snapshotDir, 'src'), { recursive: true });

const result = spawnSync(process.execPath, [join(snapshotDir, 'src', 'sim', 'run.ts'), ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
