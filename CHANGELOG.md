# Changelog

All notable changes to `@ejosterberg/opensalestax` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-05-14

Initial public release. Extracted from the embedded HTTP clients in
the four TS connector repos (Medusa, Vendure, Saleor, Square) per the
constitution §6 / new-connector playbook trigger ("extract when a
third TS connector lands"; we have four).

### Added

- `OpenSalesTaxClient` — thin wrapper over the OpenSalesTax v1 HTTP API
  (`health`, `states`, `rates`, `calculate`, `close`, `healthCheck`)
- Full TypeScript types (camelCase at the public surface; snake_case ↔
  camelCase translation at the request / response boundary)
- Flat error hierarchy: `OpenSalesTaxError`, `OpenSalesTaxNetworkError`,
  `OpenSalesTaxAPIError`, `OpenSalesTaxValidationError`, `NonUSDError`
- SSRF defense via `validateEngineUrl()` (loopback / RFC-1918 / IPv6
  link-local detection, with `allowPrivate` opt-in)
- Injectable `fetch` implementation for tests + custom HTTP behavior
- Dual ESM + CJS publish via `package.json` `exports` map
- 81 Jest tests; 90%+ statement coverage, 91%+ branch coverage

### Notes

- Zero runtime dependencies. Uses built-in `fetch`, `URL`,
  `AbortController` (Node 20+).
- The `verify` option is reserved for parity with the Python SDK; to
  actually disable TLS verification, inject a custom `fetch` built
  on `undici`'s Agent with `rejectUnauthorized: false`. The SDK does
  not pull `undici` in directly to keep the dep tree empty.

[Unreleased]: https://github.com/ejosterberg/opensalestax-js/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ejosterberg/opensalestax-js/releases/tag/v0.1.0
