import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertIntegrity, integrityOf } from "./integrity.ts";

// SHA-512 of "abc", FIPS 180-4's example, in npm's dist.integrity form.
const ABC =
  "sha512-3a81oZNherrMQXNJriBBMRLm+k6JqX6iCp7u5ktV05ohkpkqJ0/BqDa6PCOj/uu9RU1EI2Q86A4qmslPpUyknw==";

describe("the tarball's integrity across the consumer run", () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tunnistus-oidc-integrity-"));
    file = join(dir, "kuutti-ry-tunnistus-oidc-0.0.0.tgz");
    writeFileSync(file, "abc");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("names the file's bytes in npm's dist.integrity form", () => {
    expect(integrityOf(file)).toBe(ABC);
  });

  it("passes a file whose bytes are what they were, whatever happened to its metadata", () => {
    const packed = integrityOf(file);
    writeFileSync(file, "abc");
    utimesSync(file, new Date(0), new Date(0));
    expect(() => assertIntegrity(file, packed)).not.toThrow();
  });

  it("refuses a file whose bytes changed, naming both digests", () => {
    const packed = integrityOf(file);
    writeFileSync(file, "abd");
    expect(() => assertIntegrity(file, packed)).toThrow(
      `${file} changed: packed as ${packed}, now sha512-`,
    );
    expect(() => assertIntegrity(file, packed)).not.toThrow(`now ${packed}`);
  });

  it("refuses a file that is gone", () => {
    const packed = integrityOf(file);
    rmSync(file);
    expect(() => assertIntegrity(file, packed)).toThrow(/ENOENT/);
  });
});
