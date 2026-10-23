# Changelog

Every notable change to `@kuutti-ry/tunnistus-oidc`, newest first, in the shape of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), `0.y.z` until the API has settled against Telia's production service. A release is the tag `vX.Y.Z` on this repository (`RELEASING.md`). The package is unofficial: written by Kuutti ry, not by Telia.

## [0.1.1] - 2026-10-23

The first release published by the workflow (`RELEASING.md`): npm trusted publishing, with provenance naming this repository, `publish.yml` and the commit. 0.1.0 was published by hand, since npm registers a trusted publisher only on a package that exists. Nothing of the library changed: `dist/` is 0.1.0's, built from the same sources.

### Fixed

- `publish.yml`: after publishing, the check that the version is on the registry asks again for up to two minutes, since the registry can take a moment to show a version it has accepted; before, that could fail a job whose publish had succeeded.

## [0.1.0] - 2026-10-22

The first release: the client [Kuutti](https://github.com/kuutti-ry/kuutti-app) has run against Telia's pre-production bed since 2026-10-08, taken out of the application on that day (its ADR-017), hardened since, and given this repository of its own on 2026-10-22; the history came with it.

### Added

- `createTunnistusClient(options)`: the OpenID Connect client in Telia Tunnistus's dialect, as the integration guide v2.36 specifies it: a signed request object (RS256, `typ: JWT`, ten minutes, `acr_values` mandatory under Traficom 213/2023 S), `private_key_jwt` at the token endpoint with `aud` = the token endpoint, and an ID token that must arrive as a JWE (RSA-OAEP with A128CBC-HS256 or A128GCM) encrypted to the `enc` key, signed by Telia and verified against the issuer's JWKS, which is read by URL and never pinned, so a rotated key is picked up without a restart. `startLogin` takes `state`, `nonce`, `uiLocales` (sent as `ui_locales`) and `prompt`; `completeLogin` returns every FTN claim typed (`FtnIdentity`) and throws `TunnistusError` with a reason and nothing of the person. The `plain` dialect runs the same client against a local mock over http.
- Refusals before the broker is asked: the Telia dialect without both keys or without a level, a key that is not RSA of 2048 bits or more, Telia's host over http, on another port or in the plain dialect. Refusal of the broker's document: one on Telia's host that does not offer `private_key_jwt`. Refusals of the answer: an ID token in the clear, without `auth_time`, with another nonce or audience, signed by a key the JWKS does not hold, at a level other than the one asked for, or without the personal identity code.
- `discoverProvider(issuer)`: the provider metadata, validated, the issuer checked character for character.
- `keyIdOf(pem)` and `publicJwk(pem, use)`: the RFC 7638 thumbprint Telia names the `enc` key by in every JWE header, and the JWK to register.
- `@kuutti-ry/tunnistus-oidc/hetu`: the Finnish personal identity code: parse, every century sign of the 2023 reform, the check character, the reason a code is refused, age from year and month, and a generator for seeds and tests. It never derives legal sex.
- `@kuutti-ry/tunnistus-oidc/testing`: `fakeTelia()`, the broker as the guide describes it, in process, checking every requirement and able to misbehave on purpose. Needs `hono`.
