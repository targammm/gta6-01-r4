// main.ts — Solmar Bay r4 build plumbing: copies game/ + screenshots/ into the
// output directory and writes the make.fun dossier next to them.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = import.meta.dirname;
const outDir = process.env.MAKEFUN_OUTPUT_DIR
  ? join(root, process.env.MAKEFUN_OUTPUT_DIR)
  : join(root, "out");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(root, "game"), join(outDir, "game"), { recursive: true });
cpSync(join(root, "screenshots"), join(outDir, "screenshots"), { recursive: true });

const dossierText = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, "dossier.json"), dossierText);
console.log(`dossier written: ${Buffer.byteLength(dossierText)} bytes (cap 1.5 MiB)`);
