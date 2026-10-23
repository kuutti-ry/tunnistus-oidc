/**
 * build: dist/ for the npm tarball (kuutti-app's ADR-017 §6). tsc compiles src/ with
 * tsconfig.build.json (declarations, tests left out); then the one thing tsc
 * leaves to us: rewriteRelativeImportExtensions turns "./client.ts" into
 * "./client.js" in the JavaScript and keeps ".ts" in the declaration files,
 * which a consumer's TypeScript refuses unless it too allows importing .ts
 * extensions, so the declarations' relative specifiers get ".js" here. The
 * workspace never reads dist/: its exports stay on src/.
 *
 * Usage: pnpm build
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const pkgDir = resolve(import.meta.dirname, "..");
const dist = join(pkgDir, "dist");
rmSync(dist, { recursive: true, force: true });
execFileSync("pnpm", ["exec", "tsc", "-p", "tsconfig.build.json"], {
  cwd: pkgDir,
  stdio: "inherit",
});

// A relative specifier ending in .ts, in a static or a dynamic import.
const RELATIVE_TS = /(["'])(\.\.?\/[^"']*?)\.ts\1/g;
let rewritten = 0;
for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".d.ts")) continue;
  const path = join(entry.parentPath, entry.name);
  const before = readFileSync(path, "utf8");
  const after = before.replace(RELATIVE_TS, "$1$2.js$1");
  if (after !== before) {
    writeFileSync(path, after);
    rewritten += 1;
  }
}
console.log(`built ${dist}; relative specifiers rewritten in ${rewritten} declaration files`);
