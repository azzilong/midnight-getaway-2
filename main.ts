// Midnight Getaway — entry hand-in for the make.fun best-heist-game bounty.
//
// What this program does, in plain terms: it takes this repository's game/
// (the playable game, plain static files) and screenshots/ (four real
// renders of the game running in a browser) and hands them to the grader by
// copying them into the output directory and writing dossier.json there.
// The dossier is built by the vendored make.fun library
// (vendor/makefun-game.ts), which reads the copied files and writes the
// summary the judge reads — the game block, the sources, and the screenshot
// list — so the dossier always matches exactly what was handed in.
//
// Run it locally the same way the grader runs it, with MAKEFUN_OUTPUT_DIR
// standing in for the grader's /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The two runs the grader performs must write identical bytes: this program
// only copies files and calls the deterministic buildDossier, so they do.

import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const from = join(sourceDir, entry.name);
    const to = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
    }
    // Anything that is not a plain file or directory (symlinks included)
    // is left out on purpose: the gate only accepts plain files.
  }
}

mkdirSync(outDir, { recursive: true });

// The game itself.
copyTree(join(repoRoot, 'game'), join(outDir, 'game'));

// The screenshots (the first by name is the cover).
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
}

// The dossier, written from the copied files so it can never drift from
// what the grader sees. Caps mirror the gate: at most 4 screenshots of
// 256 KiB, at most 993 game files totalling 48 MiB, paths under 1000 bytes,
// and the dossier text capped at 160 KiB.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const shotCount = existsSync(join(outDir, 'screenshots'))
  ? readdirSync(join(outDir, 'screenshots')).length
  : 0;
console.log(`handed in game/ + ${shotCount} screenshots + dossier.json to ${outDir}`);
