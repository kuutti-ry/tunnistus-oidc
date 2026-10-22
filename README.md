# @kuutti-ry/tunnistus-oidc

A relying-party kit for [Telia Tunnistus](https://github.com/telia-oss/tunnistus), the Finnish Trust Network identification broker, for Node 22+. It does what Telia's integration guide (v2.36) asks of a client and what no sample does: it ships a faithful in-process double of the broker, so the whole dialect is tested without a contract, a network or a port.

MIT-licensed (see `LICENSE`), so that the next Finnish relying party can take it; written for [Kuutti](https://github.com/kuutti-ry/kuutti-app), the association's dating app, which is its first consumer. Unofficial: written by Kuutti ry, not by Telia, and Telia Tunnistus is Telia's mark. Published to npm from this repository with provenance (`RELEASING.md`); `CHANGELOG.md` lists the versions.

## Install

```bash
npm install @kuutti-ry/tunnistus-oidc
```

Node 22.18 or later, ESM. The test double under `./testing` needs `hono` as well (`npm install --save-dev hono`).

## What it does

- **`createTunnistusClient(options)`**: the OpenID Connect client in Telia's dialect: a signed request object (RS256, `acr_values` mandatory under Traficom 213/2023 S), `private_key_jwt` at the token endpoint with `aud` = the token endpoint, and an ID token that arrives as a JWE encrypted to your `enc` key and signed by Telia, verified against the issuer's JWKS, which is read by URL and never pinned, so a rotated key is picked up without a restart. It refuses to start in Telia's dialect without a level to ask for, or with a key under 2048 bits, before the broker is asked anything, and against a discovery document that does not offer `private_key_jwt`. Telia's two hosts take that dialect and no other, in any case, over https on the default port, written or not: the `plain` dialect, http or another port on them is refused. The `plain` dialect runs the same client against any other OpenID provider, over http too, for a local mock.
- **`discoverProvider(issuer)`**: the provider metadata, validated, with the issuer checked character for character, and on Telia's host `private_key_jwt` required.
- **`keyIdOf(pem)`** and **`publicJwk(pem, use)`**: the RFC 7638 thumbprint Telia names your `enc` key by in every JWE header, and the JWK you register; both refuse a key that is not RSA of 2048 bits or more.
- **`@kuutti-ry/tunnistus-oidc/hetu`**: the Finnish personal identity code (henkilötunnus): parse, every century sign of the 2023 reform, check character, the reason a code is refused (`format`, `checksum`, `date`, `individual`, safe to log), age from year and month, and a generator for seeds and tests (birth years 1800–2099, which the century signs carry; a `RangeError` outside them). It never derives legal sex.
- **`@kuutti-ry/tunnistus-oidc/testing`**: `fakeTelia()`, the broker as the guide describes it, answering through a `fetch` function under the real pre-production issuer, checking every requirement and able to misbehave on purpose (a plain ID token, a stranger's key, another nonce or audience, no identity code, no `auth_time`, a rotated signing key, a person who cancels). Needs `hono` (an optional peer dependency).

## Use

```ts
import { ACR_LOATEST2, createTunnistusClient, TunnistusError } from "@kuutti-ry/tunnistus-oidc";

const telia = await createTunnistusClient({
  issuer: "https://tunnistus-pp.telia.fi/uas",
  clientId: "…", // assigned by Telia at registration
  redirectUri: "https://api.example.fi/auth/callback", // registered, exact, https
  acrValues: ACR_LOATEST2, // ACR_LOA2 in production
  signingKeyPem, // PKCS#8, RSA 2048+, the key whose public JWK you registered with "use": "sig"
  encryptionKeyPem, // the "use": "enc" one; the ID token is encrypted to it
});

// 1. Send the browser to the bank chooser; keep state and nonce server-side.
const url = await telia.startLogin({ state, nonce, uiLocales: "fi", prompt: "login" });

// 2. At your redirect URI, exchange the code. Everything is verified before this returns:
//    state, nonce, the JWE, the JWS signature against the JWKS, iss, aud, exp, acr, auth_time.
try {
  const person = await telia.completeLogin({ callbackUrl: new URL(request.url), state, nonce });
  person.personalIdentityCode; // in memory only; derive what you keep and drop it
  person.acr; // the level asked for
  person.amr; // the method, as a URI Telia names it
  person.authenticatedAt; // auth_time
} catch (error) {
  if (error instanceof TunnistusError) error.reason; // "unexpected acr", "no identity code", …
}
```

The person who backs out at the bank comes back with `error=access_denied` and no code; read the query before calling `completeLogin`.

Keys: two RSA pairs of 2048 bits or more (guide 2.1.1). Keep the private halves where your service reads secrets, and send Telia the two public JWKs with your redirect URIs and `ftn_spname`; the `kid` of each is its RFC 7638 thumbprint, which is what Telia's JWE header names.

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out sig.pem
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out enc.pem
```

```ts
import { publicJwk } from "@kuutti-ry/tunnistus-oidc";

const registration = { keys: [publicJwk(sigPem, "sig"), publicJwk(encPem, "enc")] }; // what goes to Telia
```

Telia's pre-production bed is `tunnistus-pp.telia.fi`, production `tunnistus.telia.fi`.

## Testing with the double

```ts
import { fakeTelia } from "@kuutti-ry/tunnistus-oidc/testing";

const telia = await fakeTelia();
const client = await createTunnistusClient({ ...telia, acrValues: ACR_LOATEST2, fetch: telia.fetch });
const url = await client.startLogin({ state, nonce });
const back = await telia.authorize(url); // the browser's trip, in process
const person = await client.completeLogin({ callbackUrl: back, state, nonce });
telia.misbehave.plainIdToken = true; // and so on; see `Misbehaviour`
```

`src/client.telia.test.ts` is the conformance suite: each requirement of the guide is either produced by the client and checked by the double, or produced wrongly by the double and refused by the client. `pnpm check:tarball` is the consumer's view: the package built, packed, installed with npm outside the repository, this README's login run from the installed files and a consumer type-checked under `nodenext`; it runs in CI and before every publish.

## Conformance

Guide v2.36, read in full on 2026-10-22, against the tests. The guide's section, what it asks, and the test that proves the client does it or refuses the opposite (`src/client.telia.test.ts` unless named otherwise):

| guide | what | test |
|---|---|---|
| 2.1.1, 2.3 | two RSA keys, `sig` and `enc`, 2048 bits or more | "does not start against a Telia issuer without both keys…"; `client.options.test.ts` and `keys.test.ts`, the short key |
| 2.1.3 | the registered redirect URI, exactly | "uses the registered redirect URI…" |
| 2.2, 2.7 | endpoints and keys from discovery; a rotated key without a restart | `discovery.test.ts`; "picks up a rotated…" |
| 2.4.1–2.4.4 | the signed request object and its claims (`typ: JWT`, ten minutes) | "sends the authentication request…" (the double verifies the signature and every claim) |
| 2.5 | `code` and `state` back; `error=access_denied` on cancel | "sends the person who cancels…" |
| 2.6.1–2.6.2 | `private_key_jwt`: `iss`=`sub`=`client_id`, `aud`= the token endpoint, `jti` once, `exp` within 60 minutes | "authenticates the token request…" |
| 2.6.3–2.6.4 | the ID token a JWE (RSA-OAEP; A128CBC-HS256 or A128GCM) around an RS256 JWS verified against the JWKS; `iss`, `aud`, `exp`, `nonce`, `acr`, `auth_time`; the FTN claims; a token in the clear refused | "…decrypts and verifies…", "decrypts an ID token under either content encryption…", "refuses an ID token that is not encrypted…", "refuses an ID token without auth_time…" |
| 2.6.5 | a non-Finnish method carries no identity code | "…a token without the identity code" |
| Traficom 213/2023 S | `acr_values` mandatory; the answer's `acr` the one asked for | `client.test.ts` "accepts only the level…"; `client.options.test.ts` |

The JWE header's `kid` is the registered JWK's own (its thumbprint): Telia's answer of 2026-10-08, not the guide's text. What the kit leaves out of the guide, and why, is under Not in here.

## Not in here

Everything a product decides: what of the person is kept, session handling, how often the bank is asked (Kuutti sends `prompt=login` every time and refuses an `auth_time` older than its own request; that is the caller's policy), logging. The client returns what Telia sent and throws `TunnistusError` with a reason and nothing else (no `cause`: the underlying library attaches the decoded claims to its errors, and the kit leaves them behind); it logs nothing.

Not yet, and said so: a bank chosen through `acr_values` (guide 2.4.5, `oidc.nordea.1` and the like). The kit asks for a level and accepts an answer at that level only, and the answer to a method request carries the level in `acr` and the method in `amr`, so pre-selecting a bank would need an option that tells the two apart. `max_age` (2.4.3): `prompt` is offered instead. The entity statement and the signed JWKS (2.1.2, 2.2): discovery's `jwks_uri` serves the same keys. Non-Finnish methods (2.6.5), which carry no identity code: the kit refuses the token.

## Releasing

For the maintainers: `RELEASING.md`. A release is the tag `vX.Y.Z`; the publish workflow checks the tag, builds, checks the tarball and publishes it with npm trusted publishing, so the registry's provenance names this repository, the workflow and the commit.
