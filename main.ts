// main.ts — the entry program the bounty runs: copy game/ and screenshots/
// into the output directory, then write dossier.json with the kit's own
// buildDossier, so the handed-in dossier is byte-identical to what the
// scorer computes from the same tree.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outEnv = process.env.MAKEFUN_OUTPUT_DIR;
const outputDir = outEnv ? resolve(root, outEnv) : '/output';

mkdirSync(outputDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  rmSync(join(outputDir, name), { recursive: true, force: true });
  cpSync(join(root, name), join(outputDir, name), { recursive: true });
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`dossier.json written to ${outputDir} (${dossier.length} bytes)`);
