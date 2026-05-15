# Live integration check

> Manual smoke test against the OpenSalesTax engine. Not part of CI
> (CI doesn't reach the private engine). Run before tagging a release
> to confirm the SDK round-trips correctly against a real engine
> instance.

## Prerequisites

- The engine is reachable. Eric runs one at `http://10.32.161.126:8080`.
- The SDK has been built locally: `npm run build`.

## Run

```bash
npm run build
node tests-integration/live-engine.mjs
```

Override the engine URL with `OST_ENGINE_URL=https://your-engine` if
yours lives elsewhere.

## What it asserts

| Endpoint | Assertion |
|---|---|
| `GET /v1/health` | `status === "ok"`, `databaseConnected === true`, `version` is a non-empty string |
| `healthCheck()` | Returns `{ ok: true, ... }` for a healthy engine |
| `GET /v1/states` | 52 entries (50 states + DC + US territory), `MN.tier === 1`, `MN.hasSalesTax === true` |
| `GET /v1/rates?zip5=55401` | At least 3 jurisdictions, `combinedRatePct` is a decimal string |
| `POST /v1/calculate` | `$100` ZIP `55401` → `taxTotal` in the $7–$11 range (actual: `$9.0250` at engine v0.55.4) |

## Verified run — 2026-05-14, engine v0.55.4

```
Engine: http://10.32.161.126:8080

health: {"status":"ok","version":"0.55.4","databaseConnected":true}
OK:   health.status is "ok"
OK:   health.databaseConnected is true
OK:   health.version is a non-empty string

healthCheck: {"ok":true,"version":"0.55.4","databaseConnected":true,"rttMs":15}
OK:   healthCheck.ok is true

states: total=52
OK:   states list has >40 entries (got 52)
OK:   MN appears in states list
OK:   MN hasSalesTax is true
OK:   MN tier is 1

rates(55401): combinedRatePct=9.02500, 6 jurisdictions
OK:   rates.input.zip5 echoes 55401
OK:   rates has at least 3 jurisdictions

calculate: subtotal=100.00, taxTotal=9.0250, 1 line / 6 jurisdictions
OK:   calculate.subtotal is "100.00"
OK:   calculate has 1 line
OK:   line has at least 3 jurisdictions
OK:   calculate.taxTotal is in the 7-11 dollar range (got 9.025)

Live round-trip OK against http://10.32.161.126:8080.
```

The Minneapolis jurisdictional stack the SDK round-trips:

| Jurisdiction | Type | Rate |
|---|---|---|
| Minnesota | state | 6.875% |
| Hennepin County | county | 0.15% |
| Minneapolis | city | 0.50% |
| Hennepin County Transit Sales Tax | district | 0.50% |
| Metro Area Transportation Sales Tax | district | 0.75% |
| Metro Area Sales and Use Tax for Housing | district | 0.25% |
| **Combined** | — | **9.025%** |

On $100 → $9.0250 of tax. Matches the engine's quantized
per-jurisdiction sum.

## What this gates

Adding new public methods, changing the wire-format translation, or
bumping the engine API contract should all re-run this check before
the release tag is pushed. The unit tests verify shape and error
behavior; this script verifies the SDK actually talks to a real
engine.

## First-publish bootstrap

Per `~/.claude/npm-trusted-publishing-playbook.md`, the first publish
of `@ejosterberg/opensalestax` happens **manually from Eric's
workstation** (a brand-new package name can't have a Trusted Publisher
configured before it exists on NPM):

```bash
cd C:/Users/ejosterberg/Documents/GITprojects/opensalestax-js
git pull --ff-only
npm ci
npm run build
npm login              # browser-based, 2FA via security key
npm publish --access public
```

Then configure NPM Trusted Publishing + the `npm-publish` GitHub
Environment so v0.1.1+ flows through `.github/workflows/release.yml`
on tag push.
