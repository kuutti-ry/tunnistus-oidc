# Releasing

The package is published to npm from this repository by `.github/workflows/publish.yml`, on a tag `vX.Y.Z`, through npm trusted publishing: the publish job exchanges its OIDC token with npm, no token is stored here, and npm records provenance naming this repository, the workflow and the commit. The version is semver 2.0.0, `0.y.z` until the API has settled against Telia's production service.

## Every release

1. On a branch: set `version` in `package.json`, write the entries under `## [X.Y.Z] - <date>` in `CHANGELOG.md`, run `pnpm check:tarball`, open the pull request.
2. After the merge, tag the merge commit and push the tag:

   ```bash
   git fetch origin && git tag vX.Y.Z <merge commit> && git push origin vX.Y.Z
   ```

3. The workflow's `check` job refuses a tag that does not name `package.json`'s version, a changelog without a dated entry for it, and a commit that is not on `main`; then it typechecks, tests, builds and checks the packed tarball as a consumer would, and hands the tarball on as an artifact. The `publish` job waits at the `npm` environment for the maintainer's approval, which therefore comes after the checks, takes nothing from the repository but that artifact, and publishes it. The approval has a week: the artifact lives seven days; after that, re-run the workflow's jobs, which build and check the tarball again and wait again. A version already on npm ends the run with a notice and no publish.
4. Check:

   ```bash
   npm view @kuutti-ry/tunnistus-oidc@X.Y.Z version dist.attestations.url
   ```

   The attestations URL is the provenance; the package page shows the badge.

## Once, before 0.1.0, in this order

A trusted publisher is an authority to publish, so the gates on it exist first.

1. **Repository settings** (the maintainer's): the `npm` environment with the maintainer as its required reviewer; a tag ruleset that lets only administrators create `v*` tags; the branch rule on `main` (pull requests only, with the CI and DCO checks required). Until the environment has its reviewer, a pushed tag would publish on the strength of write access alone.
2. **The first publish, by hand.** npm configures a trusted publisher on a package that already exists. On a machine signed in to npm as a member of `kuutti-ry` (`npm login`, with the account's second factor in its "authorization and writes" mode), from the merged commit checked out:

   ```bash
   pnpm install --frozen-lockfile && out="$(mktemp -d)" && pnpm check:tarball -- --out "$out" && npm publish "$out/kuutti-ry-tunnistus-oidc-0.1.0.tgz" --access public && npm logout
   ```

   `npm logout` ends the session that could publish. 0.1.0 carries no provenance; every later version does. The tag `v0.1.0` may be pushed afterwards for the record: the run finds the version on npm and ends there.
3. **The trusted publisher**, in the package's settings on npmjs.com: GitHub Actions, organisation or user `kuutti-ry`, repository `tunnistus-oidc`, workflow filename `publish.yml`, environment `npm`. The fields are case-sensitive. A configuration that has not published within two days of being made expires (npm's rule), so make it on the day of the next tag.
4. **Publishing access**, in the same settings: require two-factor authentication and disallow tokens. Trusted publishing is not a token and keeps working; from then on only the workflow and a signed-in maintainer can publish.
