// Sunset Bay — a make.fun gta6-01 entry (Node 22, standard library only).
//
// This program hands the game in: it copies this repository's game/ and
// screenshots/ into the output directory and writes /output/dossier.json,
// the summary the judge reads, using the kit's vendored library
// (vendor/makefun-game.ts, unchanged from the kit).
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (the kit's reference/gate.json): only
// text_max_bytes shapes the bytes; the rest refuse an entry the scorer
// would refuse, so passing them makes this program fail in the same places.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy a directory tree, refusing anything that is not a plain file or dir. */
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) cpSync(src, dst);
    else throw new Error(`refusing to copy ${src}: not a plain file or directory`);
  }
}

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

mkdirSync(outputDir, { recursive: true });
copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
} else {
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outputDir, DOSSIER_CAPS);
const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(dossierPath, dossier);

// The platform caps a dossier at 1.5 MiB: refuse loudly here rather than
// handing in an entry the scorer would reject.
const dossierBytes = statSync(dossierPath).size;
if (dossierBytes > 1572864) {
  throw new Error(`dossier.json is ${dossierBytes} bytes, over the 1.5 MiB cap`);
}

const gameFiles = countFiles(join(outputDir, 'game'));
const shotFiles = readdirSync(join(outputDir, 'screenshots')).filter((f) => !f.startsWith('.'));
console.log(
  `Sunset Bay handed in: ${gameFiles} game files, ${shotFiles.length} screenshots, ` +
  `dossier.json ${dossierBytes} bytes.`,
);
