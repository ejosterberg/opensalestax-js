# Phase 01 — Extract the JS/TS SDK to a standalone NPM package

## What

Carve the embedded `OpenSalesTaxClient` out of the four TS connector repos
(Medusa, Vendure, Saleor, Square) and publish it as a single standalone NPM
package, `@ejosterberg/opensalestax`, that those four (and every future TS
connector) depend on.

## Why

Constitution §6 names three SDKs (Python, JS/TS, PHP), each in its own public
repo. The Python and PHP SDKs already ship as standalone packages. The JS/TS
SDK has been re-embedded four times because we didn't yet have a third TS
connector forcing the issue. We have four now. The playbook trigger ("extract
when a third TS connector lands") fired weeks ago.

The four embedded copies have drifted:

- Medusa has no SSRF defense
- Vendure has a scheme allowlist
- Saleor has a never-throws `healthCheck()` wrapper
- Square has a full SSRF check including IPv4/IPv6 private-range detection

Continuing to copy-paste means each fix lands in zero, one, or two of the
four — a maintenance liability that grows linearly with each new TS
connector.

## Out of scope

- Caching. Cache invalidation is platform-specific (cart-id, region-id,
  ZIP-fingerprint, line-fingerprint, ...). The SDK exposes calls; consumers
  cache.
- Retry. The engine API is idempotent for `GET /v1/health`, `GET /v1/states`,
  and `GET /v1/rates`, but `POST /v1/calculate` is also idempotent in
  practice (no side-effects), so retry is technically safe. Still, retry
  semantics belong in the consumer (per-platform fail-soft policy), so the
  SDK does no retry. v0.2 may add an opt-in `retryAttempts: number` option.
- Address validation. Engine doesn't expose it; SDK doesn't ship it.
- Webhook signature verification. Belongs in the Stripe connector, not the
  SDK.

## Success criteria

1. `@ejosterberg/opensalestax` v0.1.0 published to NPM with provenance
   attestation
2. All four TS connector repos depend on the SDK and have deleted their
   embedded client
3. SonarQube on `opensalestax-js` shows 0 bugs / 0 vulnerabilities /
   0 security hotspots / 0 code smells with A across reliability, security,
   maintainability
4. 40+ Jest tests covering the surface
5. Live round-trip against the engine at `10.32.161.126:8080` succeeds
   (ZIP 55401, $100 general → ~$9.025 tax)
6. CHANGELOG documents the migration path for the four consumers

## User stories

**As the Medusa / Vendure / Saleor / Square connector maintainer:** I
`npm install @ejosterberg/opensalestax` and import
`OpenSalesTaxClient`, `Address`, `LineItem` — same shape as the local
client I deleted, with strictly better SSRF defense and a richer error
hierarchy.

**As a future TS connector author:** I add this one dependency and have
the full v1 HTTP API at my fingertips (health, states, rates, calculate),
with TS types matching the engine's wire format on both ends.

**As an OSS contributor reviewing the connectors:** I see four
near-identical HTTP clients collapsed to one well-tested package. The
diff during PR review is the connector logic, not 150 lines of boilerplate.
