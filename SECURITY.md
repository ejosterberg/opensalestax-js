# Security policy

## Supported versions

Only the latest `0.x` and the latest `1.x` (once it ships) receive
security fixes.

| Version | Supported |
|---|---|
| 0.1.x | yes |

## Reporting a vulnerability

**Do not** open a public issue for a security report. Email Eric
Osterberg directly at **ejosterberg@gmail.com** with subject
`[security] opensalestax-js: <short description>`.

Please include:

- The affected SDK version (`npm view @ejosterberg/opensalestax version`)
- A minimal reproduction or proof-of-concept
- The threat model — who is the attacker, what's at stake, how the
  attack chains end-to-end
- Whether you'd like credit in the fix's release notes (default: no
  credit unless you explicitly opt in)

We aim to acknowledge within 72 hours and ship a fix within 14 days
for high-severity issues.

## Scope

In scope:

- SSRF / SSRF-bypass via `validateEngineUrl()`
- Unsafe deserialization / prototype pollution from engine responses
- Credential / API-key leakage in error messages or logs
- Timing-channel leaks in auth handling
- Dependency vulnerabilities (`npm audit` findings)

Out of scope:

- DNS rebinding against the engine URL (the URL is set by the
  merchant, not by an end user — see `docs/MIGRATION.md` and
  `src/url.ts` comments for the threat model)
- Issues that require an already-compromised engine to exploit
- Issues in third-party platforms (Stripe, Saleor, Vendure, Medusa,
  Square) that happen to use this SDK — report those upstream first
- Theoretical complexity attacks against decimal-string parsing (the
  SDK doesn't perform arithmetic — strings round-trip)

## Disclosure

Once a fix ships, we publish a brief advisory in the affected version's
GitHub release notes and add a `## Security` entry to `CHANGELOG.md`.
We do **not** publish CVEs proactively — open an issue if you'd like
one assigned for the advisory.
