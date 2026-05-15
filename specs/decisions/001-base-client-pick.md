# Decision 001 — Pick the base HTTP client for extraction

**Date:** 2026-05-14
**Status:** Accepted

## Context

Four TS connector repos each ship their own ~150-line HTTP client against the
OpenSalesTax v1 engine API:

| Connector | Path | Notes |
|---|---|---|
| Medusa | `src/providers/opensalestax/client.ts` | Original. Smallest. No SSRF defense. Uses ReDoS-prone regex (`/\/+$/`). |
| Vendure | `src/lib/ostax-client.ts` | Adds scheme allowlist (http/https). Imperative slash strip. |
| Saleor | `src/lib/ostax-client.ts` | Adds `healthCheck()` wrapper (never-throws + RTT). Cleanly factors URL helper to `lib/url.ts`. |
| Square | `src/client.ts` | Most defensive: full SSRF check via `src/url-validator.ts` (loopback/RFC-1918/IPv6 link-local detection + `allowPrivate` opt-in). |

## Decision

**Base the new SDK on the Saleor client's structure**, then merge in:

- Square's `src/url-validator.ts` SSRF defense, ported verbatim (best-in-class
  in this set; only one with proper IPv6 + IPv4 private-range detection)
- Python SDK's full surface (`health()`, `states()`, `rates()`, `calculate()`,
  `close()`) — the existing TS clients only had `health()` + `calculate()`
- Python SDK's flat error hierarchy (`OpenSalesTaxError` → `NetworkError` /
  `APIError` / `ValidationError` / `NonUSDError`) replacing each connector's
  single `OpenSalesTaxApiError`
- Saleor's never-throws `healthCheck()` semantics as a separate convenience
  method on top of the canonical `health()`
- Fetch injection via constructor option (none of the four had this; required
  for clean unit tests without globally clobbering `globalThis.fetch`)

## Rationale

- **Saleor's `src/lib/` factoring** is the cleanest of the four — the URL
  helper is already a separate file, the client is the second file in
  `lib/`, and the rest of the connector lives outside `lib/`. That maps
  directly to a package's `src/` layout with minimal restructuring.
- **Square's URL validator is the most production-ready SSRF defense** of
  the four. Saleor and Vendure stop at scheme allowlist; Medusa has nothing;
  Square has full loopback/RFC-1918/link-local detection with an
  `allowPrivate` opt-in for dev / on-prem. Taking this as-is.
- **Python SDK parity** matters because the Odoo and ERPNext connectors
  already use the four-method surface (`health` / `states` / `rates` /
  `calculate`). The TS connectors haven't needed `states` or `rates` yet,
  but the SDK should expose them so future connectors don't have to
  re-embed an HTTP client.
- **Flat error hierarchy** lets the consumer's `catch` blocks discriminate
  network glitches (fail-soft retry candidate) from API 4xx (config
  problem, surface to operator) from schema mismatch (engine version
  drift). The single `OpenSalesTaxApiError` in the four embedded clients
  forces consumers to inspect `.status` numerically — coarser than what
  the Python SDK already offers.

## Consequences

- Each of the four consumer migrations will replace `OpenSalesTaxApiError`
  imports with the new hierarchy. Consumers that just `instanceof`-checked
  the old class need a one-line update; consumers that inspected `.status`
  keep working (the new `OpenSalesTaxAPIError` preserves `.statusCode`).
- The wire format keeps **snake_case** keys (matches what the engine emits
  and what the Python + PHP SDKs use on their internal models). At the
  TypeScript surface we expose **camelCase property names on the
  high-level result objects** so JS consumers don't have to wrestle with
  underscore keys — translation happens in the response parsers.
- Bundle stays zero-runtime-deps (built-in `fetch`, `URL`, `AbortController`).
