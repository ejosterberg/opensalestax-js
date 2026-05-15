# Contributing to `@ejosterberg/opensalestax`

Thanks for your interest! This SDK is the JavaScript / TypeScript
client for the [OpenSalesTax](https://github.com/ejosterberg/opensalestax)
engine. It's deliberately small — a thin wrapper around the engine's
v1 HTTP API.

## Scope

The SDK does:

- Wrap the engine's `/v1/health`, `/v1/states`, `/v1/rates`,
  `/v1/calculate` endpoints
- Translate snake_case wire format to camelCase TS types
- Defend against SSRF (loopback / private-network rejection)
- Expose a flat error hierarchy

The SDK does **not** do:

- Caching — that's the consumer's responsibility (cache invalidation is
  platform-specific)
- Retry — that's the consumer's fail-soft policy
- Address validation — engine doesn't expose it
- Webhook signature verification — belongs in connectors, not the SDK

If you're working on a connector and find yourself wanting one of
those, the answer is "do it in the connector, then propose it as a
v0.2 SDK feature if 3+ connectors duplicate the same logic."

## Quality bar

Every PR must:

1. **Pass `npm run check`** — lint + typecheck + tests with coverage +
   `npm audit --omit=dev --audit-level=high`
2. **Maintain coverage thresholds** — 80% lines, 70% branches (the
   `jest.config.cjs` enforces this)
3. **Have a `Signed-off-by:` trailer** on every commit (`git commit
   -s`) — DCO is enforced by CI
4. **Carry the SPDX header** on every new source file:
   `// SPDX-License-Identifier: Apache-2.0`
5. **No AI co-author trailers** in commit messages

## Local development

```bash
git clone git@github.com:ejosterberg/opensalestax-js.git
cd opensalestax-js
npm install
npm run check
```

To run the live-engine integration check, you need an engine reachable
at `http://10.32.161.126:8080` (or set `OST_ENGINE_URL` to your own):

```bash
npm run build
node tests-integration/live-engine.mjs
```

## Releasing

See [`docs/INTEGRATION-CHECK.md`](docs/INTEGRATION-CHECK.md) for the
release sequence. The first publish of a brand-new version uses NPM
Trusted Publishing via `.github/workflows/release.yml` — push a tag
`vX.Y.Z` and the workflow takes over.

## Coding conventions

- **TypeScript strict** with `exactOptionalPropertyTypes` +
  `noUncheckedIndexedAccess`. No `any`. Use `unknown` + narrowing
  when parsing untrusted JSON.
- **Per-type translators** for snake_case ↔ camelCase. No generic deep
  walkers (they add bundle size and hide bugs at code review).
- **Money + rates are decimal strings** end-to-end. No floats. Ever.
- **Zero runtime dependencies.** Anything that needs `node-fetch`,
  `axios`, `decimal.js`, etc. happens in the consumer, not the SDK.
- **Errors are subclasses** of `OpenSalesTaxError`. New error
  categories go in the hierarchy; they don't sneak in as raw
  `Error` throws.

## Reporting bugs

Use the [issue tracker](https://github.com/ejosterberg/opensalestax-js/issues).
Include:

- SDK version (`npm view @ejosterberg/opensalestax version`)
- Node version (`node -v`)
- Engine version (from `client.health().version`)
- Minimal reproduction or stack trace
