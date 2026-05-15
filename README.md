# @ejosterberg/opensalestax

[![npm](https://img.shields.io/npm/v/@ejosterberg/opensalestax.svg)](https://www.npmjs.com/package/@ejosterberg/opensalestax)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

TypeScript SDK for the self-hosted **OpenSalesTax** engine — destination-based
US sales tax via the v1 HTTP API.

> Calculation only. The merchant is solely responsible for tax-collection
> accuracy and remittance to the appropriate jurisdictions. Verify against
> your state Department of Revenue before remitting.

This is the **JavaScript / TypeScript SDK**. Sibling packages cover other
languages:

- Python — [`opensalestax`](https://pypi.org/project/opensalestax/) on PyPI
- PHP — [`ejosterberg/opensalestax`](https://packagist.org/packages/ejosterberg/opensalestax) on Packagist

## Install

```bash
npm install @ejosterberg/opensalestax
```

Requires Node 20+ (uses built-in `fetch`, `URL`, `AbortController`).
Zero runtime dependencies.

## Quick start

```ts
import { OpenSalesTaxClient } from '@ejosterberg/opensalestax';

const client = new OpenSalesTaxClient({
  baseUrl: 'https://engine.example.com',
});

const health = await client.health();
console.log(health); // { status: 'ok', version: '0.55.4', databaseConnected: true }

const result = await client.calculate(
  { zip5: '55401' },
  [{ amount: '100.00', category: 'general' }],
);
console.log(result.taxTotal);     // "9.0250"
console.log(result.lines[0].ratePct); // "9.02500"
for (const j of result.lines[0].jurisdictions) {
  console.log(`${j.type}: ${j.name} @ ${j.ratePct}% → $${j.tax}`);
}
```

## API

### `new OpenSalesTaxClient(options)`

| Option | Type | Default | Notes |
|---|---|---|---|
| `baseUrl` | `string` | (required) | Engine base URL, e.g. `https://engine.example.com` |
| `apiKey` | `string \| null` | `null` | Sent as `Authorization: Bearer <key>` |
| `timeoutMs` | `number` | `10000` | Per-request timeout via `AbortController` |
| `userAgent` | `string \| null` | `null` | Suffix appended to default `opensalestax-js/x.y.z` UA |
| `verify` | `boolean` | `true` | Reserved — TLS bypass requires injecting a custom `fetch` (see below) |
| `allowPrivate` | `boolean` | `false` | Permit loopback / RFC-1918 / link-local engine URLs |
| `fetch` | `FetchFn` | `globalThis.fetch` | Injectable `fetch`; useful for tests + instrumentation |

### Methods

| Method | Returns | Endpoint |
|---|---|---|
| `health()` | `Promise<HealthResponse>` | `GET /v1/health` |
| `healthCheck()` | `Promise<HealthCheckResult>` | `GET /v1/health` — **never throws**; returns `{ ok, rttMs, ... }` |
| `states()` | `Promise<StatesResponse>` | `GET /v1/states` |
| `rates(zip5, zip4?)` | `Promise<RateStack>` | `GET /v1/rates?zip5=...&zip4=...` |
| `calculate(address, lineItems)` | `Promise<CalculationResult>` | `POST /v1/calculate` |
| `close()` | `void` | no-op; provided for cross-SDK parity |

### Errors

```
OpenSalesTaxError
├── OpenSalesTaxNetworkError    (timeout / DNS / TCP RST / TLS)
├── OpenSalesTaxAPIError        (engine returned non-2xx; .statusCode + .responseBody)
├── OpenSalesTaxValidationError (response shape mismatch — likely engine/SDK version drift)
└── NonUSDError                 (consumer passed non-US data)
```

Typical consumer pattern:

```ts
import {
  OpenSalesTaxClient,
  OpenSalesTaxAPIError,
  OpenSalesTaxNetworkError,
} from '@ejosterberg/opensalestax';

try {
  const result = await client.calculate(address, lineItems);
} catch (err) {
  if (err instanceof OpenSalesTaxNetworkError) {
    // fail-soft: log + continue with empty tax lines (per-connector policy)
  } else if (err instanceof OpenSalesTaxAPIError && err.statusCode >= 500) {
    // engine glitch — fail-soft
  } else if (err instanceof OpenSalesTaxAPIError) {
    // 4xx — surface to operator (bad config / bad data)
  } else {
    throw err;
  }
}
```

## Data shape

Money and rates are **decimal strings** end-to-end. The engine quantizes
per-jurisdiction, and the SDK never coerces to float. Use a decimal
library (`decimal.js`, `big.js`) for math; convert to `Number` only at the
last possible step.

| Wire | TS surface | Type |
|---|---|---|
| `subtotal` | `subtotal` | `string` (`"100.00"`) |
| `tax_total` | `taxTotal` | `string` (`"9.0250"`) |
| `rate_pct` | `ratePct` | `string` (`"6.87500"` means 6.875%) |
| `database_connected` | `databaseConnected` | `boolean` |
| `has_sales_tax` | `hasSalesTax` | `boolean` |
| `sst_member` | `sstMember` | `boolean` |
| `combined_rate_pct` | `combinedRatePct` | `string` |

## SSRF defense

The SDK refuses to instantiate a client whose `baseUrl` resolves to:

- A non-`http:` / non-`https:` scheme (no `file:`, `javascript:`, `gopher:`)
- A loopback hostname (`localhost`, `127.0.0.0/8`, `::1`)
- A private IPv4 range (`10/8`, `172.16/12`, `192.168/16`, `169.254/16`)
- An IPv6 unique-local (`fc00::/7`) or link-local (`fe80::/10`)

…unless you pass `allowPrivate: true`. This blocks the
common operator-misconfig SSRF where an engine URL ends up pointing back
inside the cluster (e.g. accidentally at `http://169.254.169.254/`, the
cloud metadata endpoint).

Most deployments need `allowPrivate: true` — the engine usually lives on
the same private network as the merchant's store. The opt-in forces the
operator to acknowledge the network shape.

DNS rebinding is **not** in scope: the engine URL is set by the merchant
in their own process, not by an end user.

## License

[Apache-2.0](LICENSE).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). DCO sign-off (`git commit -s`)
required on every commit; CI enforces.

## Security

See [`SECURITY.md`](SECURITY.md) for the disclosure policy.
