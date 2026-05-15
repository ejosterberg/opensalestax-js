# Migrating a connector to `@ejosterberg/opensalestax`

> Guide for the four TS connector repos (Medusa, Vendure, Saleor, Square)
> dropping their embedded `OpenSalesTaxClient` in favor of the standalone
> SDK.

## TL;DR per connector

1. `npm install @ejosterberg/opensalestax`
2. Replace local imports with SDK imports
3. Delete the embedded client + URL helper files
4. Update the few places that referenced `database_connected` / `rate_pct` /
   `tax_total` to use `databaseConnected` / `ratePct` / `taxTotal`
5. Bump the connector's package version + run `npm run check`
6. Commit with DCO sign-off

## API shape changes

The embedded clients exposed snake_case property names verbatim from the
engine wire format. The SDK exposes **camelCase** at its TypeScript
surface. Translation is one-to-one:

| Embedded (snake_case) | SDK (camelCase) |
|---|---|
| `health.database_connected` | `health.databaseConnected` |
| `result.tax_total` | `result.taxTotal` |
| `line.rate_pct` | `line.ratePct` |
| `jurisdiction.rate_pct` | `jurisdiction.ratePct` |
| `state.has_sales_tax` | `state.hasSalesTax` |
| `state.sst_member` | `state.sstMember` |
| `rates.combined_rate_pct` | `rates.combinedRatePct` |

Request payload key names are unchanged (you don't construct them by
hand — `client.calculate(address, lineItems)` builds the
`line_items: [...]` wire body internally).

## Error class changes

The four embedded clients all defined a single `OpenSalesTaxApiError`.
The SDK ships a flat hierarchy mirroring the Python SDK:

```
OpenSalesTaxError
├── OpenSalesTaxNetworkError    (timeout / ECONNREFUSED / DNS)
├── OpenSalesTaxAPIError        (engine returned non-2xx; .statusCode)
├── OpenSalesTaxValidationError (response shape mismatch)
└── NonUSDError                 (consumer passed non-US data)
```

- The class name changed: `OpenSalesTaxApiError` → `OpenSalesTaxAPIError`
  (capital `API` to match the Python SDK; this is the rename load-bearing
  consumers feel).
- The instance field `.status` is now `.statusCode`. Same shape, more
  descriptive name.
- Network errors that used to throw the same `OpenSalesTaxApiError`
  now throw `OpenSalesTaxNetworkError`. Consumers that need to
  fail-soft can catch this specific subclass.

## Per-connector migration

### Saleor (`opensalestax-saleor`)

```diff
 // src/handlers/...
-import { OpenSalesTaxClient } from '../lib/ostax-client';
+import { OpenSalesTaxClient } from '@ejosterberg/opensalestax';
```

- Delete `src/lib/ostax-client.ts` and `src/lib/url.ts`.
- Update any reference to `h.database_connected` → `h.databaseConnected`.
- Tests that imported `OpenSalesTaxApiError` from `../../src/lib/ostax-client`:
  switch to `import { OpenSalesTaxAPIError } from '@ejosterberg/opensalestax'`
  and bump the class-name capitalization.

### Vendure (`opensalestax-vendure`)

```diff
 // src/strategies/...
-import { OpenSalesTaxClient } from './lib/ostax-client';
+import { OpenSalesTaxClient } from '@ejosterberg/opensalestax';
```

- Delete `src/lib/ostax-client.ts`.
- Same property-name + error-class updates as Saleor.

### Medusa (`opensalestax-medusa`)

```diff
 // src/providers/opensalestax/service.ts
-import { OpenSalesTaxClient } from './client';
+import { OpenSalesTaxClient } from '@ejosterberg/opensalestax';
```

- Delete `src/providers/opensalestax/client.ts`.
- Medusa was the first connector and exposed the raw `OpenSalesTaxApiError`
  in its provider-error wrapper — rename to `OpenSalesTaxAPIError` and
  update test imports.

### Square (`opensalestax-square`)

```diff
 // src/calculate-invoice.ts (and similar)
-import { OpenSalesTaxClient } from './client';
+import { OpenSalesTaxClient } from '@ejosterberg/opensalestax';
```

- Delete `src/client.ts` and `src/url-validator.ts` (the SDK's
  `validateEngineUrl` is the same function, ported verbatim).
- Consumers that imported `UrlValidationError` from `./url-validator`
  switch to `import { UrlValidationError } from '@ejosterberg/opensalestax'`.

## Allowing private-network engines

The SDK defaults to **rejecting** loopback / RFC-1918 / link-local
hostnames (SSRF defense). Each connector that needs to talk to an
engine on a private network — which is most of them, since the
engine ships as a Docker compose stack on the same LAN as the
merchant's store — must pass `allowPrivate: true`:

```ts
new OpenSalesTaxClient({
  baseUrl: 'http://10.32.161.126:8080',
  allowPrivate: true,
});
```

This is **deliberate**. The opt-in forces the connector author to
acknowledge the engine URL won't be sanity-checked against
private-IP exfiltration. For SaaS-hosted engines on the public
internet, leave the default (false).

## Version bumps

| Connector | Current | After migration | Reason |
|---|---|---|---|
| Saleor | v1.0.x | **v1.1.0** | Minor — drops embedded client, gains SDK dep. Public API of the connector is unchanged. |
| Vendure | v1.0.x | **v1.1.0** | Same |
| Medusa | v0.1.x | **v0.2.0** | Minor, in alpha range |
| Square | v0.1.0-alpha.1 | **v0.1.0-alpha.2** | Still alpha; stays alpha until live-platform smoke |

None of these are breaking releases — the connector's own public surface
is unchanged. The internal HTTP client got refactored out, that's all.

## Gate: blocked on SDK first publish

Until `@ejosterberg/opensalestax@0.1.0` exists on NPM, `npm install` in
each consumer repo will fail with E404. Each consumer's migration
commit is therefore prepared but its release tag waits on the SDK's
first publish.

Eric handles the SDK's first publish manually (per
`~/.claude/npm-trusted-publishing-playbook.md`). Once it's live, each
consumer's `npm version minor && git push --follow-tags` triggers
the consumer's own Trusted Publishing release.
