# Phase 01 — Plan

## File layout (matches Python SDK's flat shape)

```
opensalestax-js/
├── package.json                  # "@ejosterberg/opensalestax" v0.1.0
├── tsconfig.json                 # strict + ESM + decl
├── tsconfig.build.json           # build-only excludes (tests)
├── jest.config.js                # ts-jest, 70% coverage thresholds
├── eslint.config.js              # ESLint 9 flat config (lifted from Saleor)
├── .github/workflows/
│   ├── ci.yml                    # lint + typecheck + test on push/PR
│   └── release.yml               # NPM Trusted Publishing on v* tag
├── src/
│   ├── index.ts                  # re-export the public surface
│   ├── client.ts                 # OpenSalesTaxClient (the workhorse)
│   ├── errors.ts                 # flat error hierarchy
│   ├── models.ts                 # request/response interfaces + parsers
│   ├── url.ts                    # validateEngineUrl() + stripTrailingSlashes()
│   └── version.ts                # __version__ constant for User-Agent
├── tests/
│   ├── client.test.ts            # happy path, error paths, fetch injection
│   ├── client-health.test.ts     # health() + healthCheck() never-throws
│   ├── client-states.test.ts     # states() shape
│   ├── client-rates.test.ts      # rates() shape, optional zip4
│   ├── client-calculate.test.ts  # calculate() camelCase ↔ snake_case
│   ├── errors.test.ts            # each error class
│   ├── url.test.ts               # SSRF defense, scheme allowlist, slash strip
│   └── models.test.ts            # parsing edge cases
├── docs/
│   ├── INTEGRATION-CHECK.md      # live engine round-trip script + output
│   └── MIGRATION.md              # how the four consumers swap over
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE                       # Apache 2.0
└── sonar-project.properties
```

## Public surface

```ts
// index.ts
export { OpenSalesTaxClient } from './client';
export type {
  OpenSalesTaxClientOptions,
  Address,
  LineItem,
  CalculationResult,
  CalculatedLine,
  JurisdictionRate,
  HealthResponse,
  StateCoverage,
  StatesResponse,
  RateStack,
  JurisdictionType,
} from './models';
export {
  OpenSalesTaxError,
  OpenSalesTaxNetworkError,
  OpenSalesTaxAPIError,
  OpenSalesTaxValidationError,
  NonUSDError,
} from './errors';
export { validateEngineUrl, UrlValidationError } from './url';
export { VERSION } from './version';
```

## Wire format vs. JS surface

Engine wire format uses snake_case. JS consumers prefer camelCase. The
SDK exposes **camelCase** at its public TS surface (`taxTotal`, `ratePct`,
`databaseConnected`) while serializing **snake_case** on the request
payload and parsing **snake_case** from response bodies.

Translation lives in `models.ts` — `toCamelCase` / `toSnakeCase` per type,
not a generic deep walker (generic walkers add bundle size and surprise
when a field name happens to look like a casing boundary).

## Error hierarchy

```
OpenSalesTaxError extends Error
├── OpenSalesTaxNetworkError    (timeout / DNS / TCP RST / TLS)
├── OpenSalesTaxAPIError        (engine returned non-2xx; .statusCode set)
├── OpenSalesTaxValidationError (response shape mismatch)
└── NonUSDError                 (consumer passed non-US data)
```

Each class has a static `name` so `instanceof` works after minification and
the message format is stable.

## SSRF defense

`validateEngineUrl(url, { allowPrivate })`:

- Parses URL — throws `UrlValidationError` if not parseable
- Verifies scheme is http: or https:
- If `allowPrivate` is `false` (default): rejects loopback / RFC-1918 /
  link-local IPv4 and IPv6
- Returns the parsed URL on success

DNS resolution is out of scope (per Square's note: the engine URL is set
by the merchant, not by an end user, so DNS rebinding is not the threat
model). The defense protects against operator config mistakes — e.g.
accidentally pointing at `http://169.254.169.254/` (cloud metadata).

## Build

- `tsc` with `module: "ESNext"` for ESM output → `dist/esm/`
- `tsc` with `module: "CommonJS"` for CJS output → `dist/cjs/`
- `package.json` `exports` map publishes both with `types` declarations
- Avoid `tsup` / bundlers for v0.1; raw `tsc` is enough and keeps the
  dep tree zero-runtime / minimal-dev

```json
"exports": {
  ".": {
    "types": "./dist/types/index.d.ts",
    "import": "./dist/esm/index.js",
    "require": "./dist/cjs/index.js"
  }
}
```

## Testing

- Jest with `ts-jest`
- Inject `fetch` via constructor option for unit tests — no
  `global.fetch =` clobbering
- Coverage threshold: 80% lines, 70% branches
- Target: 40+ tests covering each public method, each error class, each
  URL validator branch, snake_case ↔ camelCase round-trip, fetch
  injection, timeout, missing-API-key

## Release pipeline

- `release.yml` follows `~/.claude/npm-trusted-publishing-playbook.md`
  exactly: `node-version: "24"`, `environment: npm-publish`,
  `permissions: id-token: write`, `npm publish --access public
  --provenance`
- First publish is manual via `npm login` from Eric's workstation (the
  bootstrap step from the playbook — the package doesn't exist on NPM
  yet, so Trusted Publishing can't be configured)
- v0.1.1+ flow through the workflow

## Quality gate

`npm run check` runs: lint → typecheck → test (with coverage) → audit.
Fast — under 30 seconds locally on a fresh `npm ci`.
