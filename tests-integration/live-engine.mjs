// SPDX-License-Identifier: Apache-2.0

/**
 * Live round-trip smoke test against the engine at 10.32.161.126:8080.
 *
 * Not part of the CI suite (CI doesn't reach the private engine). Run
 * manually before tagging a release:
 *
 *   npm run build
 *   node tests-integration/live-engine.mjs
 *
 * Asserts:
 *   - GET /v1/health returns ok + databaseConnected
 *   - GET /v1/states returns a non-empty list with MN tier 1
 *   - GET /v1/rates?zip5=55401 returns the expected jurisdictions
 *   - POST /v1/calculate ($100 general, ZIP 55401) returns ~$9.03 tax
 */

import { OpenSalesTaxClient } from '../dist/esm/index.js';

const ENGINE = process.env.OST_ENGINE_URL ?? 'http://10.32.161.126:8080';

const client = new OpenSalesTaxClient({
  baseUrl: ENGINE,
  allowPrivate: true,
  timeoutMs: 5000,
});

function assert(cond, message) {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`OK:   ${message}`);
}

console.log(`Engine: ${ENGINE}`);
console.log('');

// health
const h = await client.health();
console.log('health:', JSON.stringify(h));
assert(h.status === 'ok', 'health.status is "ok"');
assert(h.databaseConnected === true, 'health.databaseConnected is true');
assert(typeof h.version === 'string' && h.version.length > 0, 'health.version is a non-empty string');

// healthCheck
const hc = await client.healthCheck();
console.log('healthCheck:', JSON.stringify(hc));
assert(hc.ok === true, 'healthCheck.ok is true');

// states
const s = await client.states();
console.log(`states: total=${s.total}, first 3: ${JSON.stringify(s.states.slice(0, 3))}`);
assert(s.states.length > 40, `states list has >40 entries (got ${s.states.length})`);
const mn = s.states.find((st) => st.abbrev === 'MN');
assert(mn !== undefined, 'MN appears in states list');
assert(mn.hasSalesTax === true, 'MN hasSalesTax is true');
assert(mn.tier === 1, 'MN tier is 1');

// rates
const r = await client.rates('55401');
console.log('rates(55401):', JSON.stringify(r));
assert(r.input.zip5 === '55401', 'rates.input.zip5 echoes 55401');
assert(r.jurisdictions.length >= 3, 'rates has at least 3 jurisdictions');
assert(typeof r.combinedRatePct === 'string', 'rates.combinedRatePct is a string');

// calculate
const c = await client.calculate(
  { zip5: '55401' },
  [{ amount: '100.00', category: 'general' }],
);
console.log('calculate:', JSON.stringify(c));
assert(c.subtotal === '100.00', 'calculate.subtotal is "100.00"');
assert(c.lines.length === 1, 'calculate has 1 line');
assert(c.lines[0].jurisdictions.length >= 3, 'line has at least 3 jurisdictions');
assert(typeof c.taxTotal === 'string', 'calculate.taxTotal is a string');
const tax = Number.parseFloat(c.taxTotal);
assert(tax > 7 && tax < 11, `calculate.taxTotal is in the 7-11 dollar range (got ${tax})`);

client.close();
console.log('');
console.log(`Live round-trip OK against ${ENGINE}.`);
