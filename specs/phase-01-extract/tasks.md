# Phase 01 — Tasks

Ordered execution list. Cross off in commit trailers.

## SDK

- [x] Decision doc — pick base client (see `specs/decisions/001-base-client-pick.md`)
- [x] Spec + plan + tasks
- [x] Bootstrap: `package.json`, `tsconfig.json`, `tsconfig.build.json`,
      `eslint.config.js`, `jest.config.js`, `.gitignore`
- [x] `src/version.ts`
- [x] `src/url.ts` — ported from Square's `url-validator.ts`
- [x] `src/errors.ts` — flat hierarchy
- [x] `src/models.ts` — interfaces + camelCase/snake_case translators
- [x] `src/client.ts` — the workhorse
- [x] `src/index.ts` — public re-exports
- [x] `tests/url.test.ts` — SSRF defense + scheme allowlist
- [x] `tests/errors.test.ts`
- [x] `tests/models.test.ts`
- [x] `tests/client.test.ts` — happy path + fetch injection
- [x] `tests/client-health.test.ts` — never-throws healthCheck()
- [x] `tests/client-states.test.ts`
- [x] `tests/client-rates.test.ts`
- [x] `tests/client-calculate.test.ts`
- [x] Lint + typecheck pass clean
- [x] All tests green; coverage ≥ thresholds
- [x] `npm audit --omit=dev --audit-level=high` clean
- [x] SonarQube project created; scan to 0/0/0/0 with A ratings
- [x] `docs/INTEGRATION-CHECK.md` — live round-trip vs. engine
- [x] `docs/MIGRATION.md` — guide for the four consumers
- [x] `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`
- [x] `.github/workflows/release.yml` — playbook-compliant template
- [x] `.github/workflows/ci.yml` — push/PR gate
- [x] `sonar-project.properties`
- [x] First commit with DCO sign-off
- [x] `gh repo create ejosterberg/opensalestax-js --public --source . --push`
- [x] Tag `v0.1.0` + GitHub release (notes from CHANGELOG)
- [ ] Eric: manual `npm login` + `npm publish` from workstation (per playbook)
- [ ] Eric: configure NPM Trusted Publisher + GitHub Environment
      `npm-publish` so v0.1.1+ auto-publishes

## Consumer migrations (each a single focused commit)

- [x] **Saleor** — depend on `@ejosterberg/opensalestax`, delete
      `src/lib/ostax-client.ts` + `src/lib/url.ts`, bump to v1.1.0
      (blocked on SDK first publish; merge gated)
- [x] **Vendure** — same shape, bump to v1.1.0 (blocked on SDK first publish)
- [x] **Medusa** — same shape, bump to v0.2.0 (blocked on SDK first publish)
- [x] **Square** — same shape, bump to v0.1.0-alpha.2 (blocked on SDK first publish)
