/**
 * The tarball's bytes, held across the consumer run. check-tarball.ts installs
 * the packed tarball next to dependencies resolved from the registry and runs
 * them with its own file access, so a bad release among them could put another
 * file under the tarball's name before the publish job uploads it by that name.
 * The digest is taken right after pnpm pack and compared at the end, in this
 * process's memory, where a child has no reach. npm's dist.integrity form
 * (sha512, base64), so the published version reads back against the same string.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function integrityOf(file: string): string {
  return `sha512-${createHash("sha512").update(readFileSync(file)).digest("base64")}`;
}

/** Refuses a file whose bytes are no longer the ones `packed` names. */
export function assertIntegrity(file: string, packed: string): void {
  const actual = integrityOf(file);
  if (actual !== packed) {
    throw new Error(`${file} changed: packed as ${packed}, now ${actual}`);
  }
}
