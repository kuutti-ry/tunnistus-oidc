/**
 * check-tarball: the kit as a consumer sees it. Builds dist/ with tsc, packs
 * the package as `pnpm pack` publishes it, installs the tarball with npm in a
 * fresh directory outside the repository next to hono (the optional peer of
 * ./testing), runs the README's login against the double from the installed
 * files, and type-checks a consumer file under Node's nodenext resolution with
 * the installed declarations. The first failure ends it with exit 1.
 *
 * The install takes the dependencies from the registry as a consumer would,
 * but without their lifecycle scripts (none of them needs one, and a script is
 * how a bad release runs code) and no release younger than a day (the same
 * quarantine as pnpm-workspace.yaml's minimumReleaseAge).
 *
 * Usage: node scripts/check-tarball.ts [--out <dir>]
 *   --out keeps the tarball in <dir> (the publish job publishes that file);
 *   without it the tarball goes with the temporary directory.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const pkgDir = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as {
  name: string;
  version: string;
  peerDependencies: Record<string, string>;
};
// What `pnpm pack` names the file: the scope's @ dropped, its / a dash.
const tarballName = `${manifest.name.replace(/^@/, "").replace("/", "-")}-${manifest.version}.tgz`;
const outFlag = process.argv.indexOf("--out");
const outDir = outFlag === -1 ? null : process.argv[outFlag + 1];
if (outFlag !== -1 && !outDir) {
  console.error("usage: node scripts/check-tarball.ts [--out <dir>]");
  process.exit(2);
}

const run = (command: string, args: string[], cwd: string): void => {
  execFileSync(command, args, { cwd, stdio: "inherit" });
};

// The README's "Testing with the double", run against the installed files.
const LOGIN = `import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ACR_LOATEST2, createTunnistusClient, TunnistusError } from "${manifest.name}";
import { hetuProblem, parseHetu } from "${manifest.name}/hetu";
import { fakeTelia } from "${manifest.name}/testing";

const opaque = () => randomBytes(16).toString("base64url");
const telia = await fakeTelia();
const client = await createTunnistusClient({ ...telia, acrValues: ACR_LOATEST2, fetch: telia.fetch });

let state = opaque();
let nonce = opaque();
const person = await client.completeLogin({
  callbackUrl: await telia.authorize(await client.startLogin({ state, nonce, uiLocales: "fi", prompt: "login" })),
  state,
  nonce,
});
assert.equal(person.personalIdentityCode, "010170-999R");
assert.equal(person.acr, ACR_LOATEST2);
assert.equal(hetuProblem(person.personalIdentityCode), null);
assert.notEqual(parseHetu(person.personalIdentityCode), null);

telia.misbehave.plainIdToken = true;
state = opaque();
nonce = opaque();
const url = await client.startLogin({ state, nonce });
await assert.rejects(
  client.completeLogin({ callbackUrl: await telia.authorize(url), state, nonce }),
  (error) => error instanceof TunnistusError && error.reason === "ID token was not encrypted",
);
console.log("the README's login runs from the installed package");
`;

// A TypeScript consumer under nodenext: every entry point's types resolve
// through the exports map, and a wrong use is an error (@ts-expect-error
// fails the compile if the types did not flow).
const CONSUMER_TS = `import {
  ACR_LOA2,
  createTunnistusClient,
  type FtnIdentity,
  type TunnistusClient,
  TunnistusError,
} from "${manifest.name}";
import { ageFromYearMonth, type ParsedHetu, parseHetu } from "${manifest.name}/hetu";
import { type FakeTelia, fakeTelia } from "${manifest.name}/testing";

export async function login(telia: FakeTelia): Promise<FtnIdentity> {
  const client: TunnistusClient = await createTunnistusClient({
    ...telia,
    acrValues: ACR_LOA2,
    fetch: telia.fetch,
  });
  const url = await client.startLogin({ state: "s", nonce: "n" });
  const person = await client.completeLogin({ callbackUrl: await telia.authorize(url), state: "s", nonce: "n" });
  // @ts-expect-error the identity code is a string
  const wrong: number = person.personalIdentityCode;
  void wrong;
  return person;
}
export const parsed: ParsedHetu | null = parseHetu("010170-999R");
export const age: number = ageFromYearMonth(1970, 1, new Date(0));
export const isKitError = (error: unknown): error is TunnistusError => error instanceof TunnistusError;
export const double: () => Promise<FakeTelia> = fakeTelia;
`;

const work = mkdtempSync(join(tmpdir(), "tunnistus-oidc-consumer-"));
try {
  run("pnpm", ["run", "build"], pkgDir);
  const packDir = outDir ? resolve(outDir) : join(work, "pack");
  mkdirSync(packDir, { recursive: true });
  run("pnpm", ["pack", "--pack-destination", packDir], pkgDir);
  const tarball = join(packDir, tarballName);
  if (!existsSync(tarball)) throw new Error(`pnpm pack did not write ${tarballName} to ${packDir}`);

  const consumer = join(work, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }, null, 2),
  );
  const aDayAgo = new Date(Date.now() - 86_400_000).toISOString();
  run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      "--ignore-scripts",
      `--before=${aDayAgo}`,
      "--loglevel=error",
      tarball,
      `hono@${manifest.peerDependencies.hono}`,
    ],
    consumer,
  );
  writeFileSync(join(consumer, "login.mjs"), LOGIN);
  run("node", ["login.mjs"], consumer);

  writeFileSync(join(consumer, "consumer.ts"), CONSUMER_TS);
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          target: "es2022",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: ["node"],
          typeRoots: [join(pkgDir, "node_modules", "@types")],
        },
        files: ["consumer.ts"],
      },
      null,
      2,
    ),
  );
  run(join(pkgDir, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.json"], consumer);
  console.log(
    `ok: ${tarballName} installs, logs in against the double, and type-checks under nodenext`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
