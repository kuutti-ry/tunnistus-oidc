# Security Policy

## Reporting a vulnerability

Please do not report security problems through public issues, discussions, or pull requests.

Report them privately through GitHub's vulnerability reporting form:

https://github.com/kuutti-ry/tunnistus-oidc/security/advisories/new

Include what you found, how to reproduce it, the affected commit or version, and any proof of concept. You will get an acknowledgement within 7 days and a status update once the issue has been assessed.

## Supported versions

Only the latest release on npm is supported. A fix lands on `main` and ships as a new version (`RELEASING.md`).

## Disclosure

Please give us reasonable time to fix the issue before disclosing it publicly. We will credit reporters in the advisory unless they prefer to stay anonymous.

## Maintainer accounts

The GitHub organisation and the npm organisation `kuutti-ry` are what protects a release: a `v*` tag publishes the package to npm through `.github/workflows/publish.yml`, after the `npm` environment's approval (`RELEASING.md`), and a member of the npm organisation can publish by hand. Organisation owners and npm organisation members therefore keep, for those accounts:

- two second factors, of which at least one is not the laptop they work on (a passkey on a phone, or a hardware security key);
- recovery codes stored off the device, in the project's password-manager entry or on paper in a place another owner knows of;
- no classic personal access token with access to the organisation, and fine-grained tokens only with the repositories and permissions the task needs.

An owner who loses a device tells the other owners the same day, revokes its sessions and tokens (GitHub, npm), and registers a new second factor before doing anything else. Nothing the project depends on may exist in one place only.
