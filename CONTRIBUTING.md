# Contributing

`@kuutti-ry/tunnistus-oidc` is the Telia Tunnistus relying-party kit of Kuutti ry: MIT-licensed, and unofficial (Telia Tunnistus is Telia's mark). It follows Telia's *Integration guide to identification broker service*, v2.36 of 2026-02-06, published at https://github.com/telia-oss/tunnistus. A change to the dialect names the guide's section in its commit message and in its test.

## Working on it

Node 22.18 or later, and pnpm through Corepack (`corepack enable` once; `package.json` pins the version).

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint          # Biome: format, lint, import order; `pnpm format` fixes most of what it names
pnpm test          # Vitest; `pnpm test:coverage` holds the floors of vitest.config.ts
pnpm check:tarball # the package as a consumer sees it: built, packed, installed with npm outside
                   # the repository, the README's login run from it, a consumer type-checked under nodenext
```

`src/client.telia.test.ts` is the conformance suite: each requirement of the guide is produced by the client and checked by the double (`src/testing/fake-telia.ts`), or produced wrongly by the double and refused by the client. A requirement gets its test on both sides; a bug gets the test that failed first, in the same change.

Two tests need more than this repository: `src/contract.live.test.ts` reads Telia's public pre-production metadata and runs only with `TELIA_CONTRACT_LIVE=1`; `src/client.mock-idp.test.ts` runs the plain dialect against the mock bank of Kuutti's local stack (`pnpm env:up` in [kuutti-ry/kuutti-app](https://github.com/kuutti-ry/kuutti-app)) and skips itself when the mock is not up.

## Rules

- TypeScript strict; no `any` in an exported signature. Small modules, named exports; the public surface is `src/index.ts`, `src/hetu.ts` and `src/testing/fake-telia.ts`.
- The kit returns what Telia sent and decides nothing for the product: what of the person is kept, how often the bank is asked, logging. It logs nothing itself, and `TunnistusError` carries a reason and never a claim.
- No personal data in the repository: the identity codes in tests are Telia's published artificial ones (individual number 900 to 999); keys are generated at run time, never committed.
- Every commit is signed off (`git commit -s`; the Developer Certificate of Origin is the `DCO` file), and the DCO check refuses one without the trailer. `main` changes through pull requests only.
- A new dependency is pinned by the lockfile and must be at least a day old (`pnpm-workspace.yaml`); name any install script of it in the pull request.

Releasing: `RELEASING.md`. Conduct: `CODE_OF_CONDUCT.md`. Security reports: `SECURITY.md`.
