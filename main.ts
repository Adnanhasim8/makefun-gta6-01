// Solmar City — the entry program (Node 22, standard library only).
//
// It hands the game in: copies game/ and screenshots/ from beside this file
// into the output directory (/output on the grader, or MAKEFUN_OUTPUT_DIR
// locally) and writes /output/dossier.json with the vendored make.fun
// library, so the scorer can rebuild the same dossier byte for byte.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps are the bounty's own gate limits (reference/gate.json): passing
// them makes this program refuse exactly where the scorer would refuse.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));

// A short human-readable summary on stdout, so the run's result is visible
// without opening the dossier. The dossier itself stays byte-identical
// between runs: this print is not part of it.
const dossier = readFileSync(join(out, 'dossier.json'));
const gameBytes = readdirSync(join(out, 'game'), { recursive: true }).length;
console.log(
  `solmar-city: wrote ${out}/dossier.json (${dossier.length} bytes) from ` +
  `${gameBytes} entries under game/ and ` +
  `${readdirSync(join(out, 'screenshots')).length} screenshots.`
);
if (dossier.length > 1572864) {
  console.warn('solmar-city: warning: dossier.json is over the 1.5 MiB gate cap.');
}
