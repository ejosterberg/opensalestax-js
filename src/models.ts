// SPDX-License-Identifier: Apache-2.0

/**
 * TypeScript surface for the OpenSalesTax v1 HTTP API.
 *
 * The engine wire format uses snake_case keys (`tax_total`, `rate_pct`,
 * `database_connected`, ...). JS consumers prefer camelCase. The SDK
 * exposes camelCase at its public surface and translates per-type at
 * the request / response boundary in this module.
 *
 * Money and rates are kept as decimal strings end-to-end — same as the
 * Python and PHP SDKs. Connectors that need numeric math convert at
 * the last possible step using their preferred decimal library
 * (decimal.js, big.js, ...). Floats are never used.
 */

import { OpenSalesTaxValidationError } from './errors.js';

// --- Common types ---------------------------------------------------

export type JurisdictionType = 'state' | 'county' | 'city' | 'district';

export interface Address {
  /** 5-digit ZIP code (US). */
  zip5: string;
  /** Optional 4-digit ZIP+4 extension. */
  zip4?: string | null;
}

export interface LineItem {
  /** Pre-tax amount, non-negative, decimal string. e.g. `"100.00"`. */
  amount: string;
  /**
   * Tax category. One of the engine's six categories (`general`,
   * `clothing`, `groceries`, `prescription_drugs`, `prepared_food`,
   * `digital_goods`) or `""` to use the engine default. Defaults to
   * `"general"` on the wire if omitted client-side.
   */
  category?: string;
}

export interface JurisdictionRate {
  name: string;
  /**
   * Jurisdiction type. Canonical values are `state` / `county` / `city`
   * / `district` (see `JurisdictionType`); the engine reserves the right
   * to emit other strings in future, hence the open `string` type here.
   */
  type: string;
  /** Rate as a percent decimal string. e.g. `"6.87500"` means 6.875%. */
  ratePct: string;
  /** Dollar contribution on /v1/calculate; `null` on /v1/rates. */
  tax: string | null;
}

// --- /v1/health -----------------------------------------------------

export interface HealthResponse {
  status: string;
  version: string;
  databaseConnected: boolean;
}

// --- /v1/states -----------------------------------------------------

export interface StateCoverage {
  /** USPS abbreviation, e.g. `"MN"`. */
  abbrev: string;
  name: string;
  hasSalesTax: boolean;
  sstMember: boolean;
  /** 0 = unsupported, 1 = fully maintained, 2 = rate-only via SST data. */
  tier: number;
  notes: string;
}

export interface StatesResponse {
  states: StateCoverage[];
  total: number;
}

// --- /v1/rates ------------------------------------------------------

export interface RateStack {
  input: { zip5: string; zip4: string | null };
  jurisdictions: JurisdictionRate[];
  /** Combined percent across all jurisdictions, decimal string. */
  combinedRatePct: string;
  disclaimer: string;
}

// --- /v1/calculate --------------------------------------------------

export interface CalculatedLine {
  amount: string;
  category: string;
  tax: string;
  ratePct: string;
  jurisdictions: JurisdictionRate[];
  note: string | null;
}

export interface CalculationResult {
  subtotal: string;
  taxTotal: string;
  lines: CalculatedLine[];
  disclaimer: string;
}

// --- snake_case ↔ camelCase translators ------------------------------
//
// We use per-type translators (not a generic deep walker) so the bundle
// stays small and the translation is obviously correct at code review.

interface WireJurisdictionRate {
  name?: unknown;
  type?: unknown;
  rate_pct?: unknown;
  tax?: unknown;
}

interface WireCalculatedLine {
  amount?: unknown;
  category?: unknown;
  tax?: unknown;
  rate_pct?: unknown;
  jurisdictions?: unknown;
  note?: unknown;
}

interface WireCalculationResult {
  subtotal?: unknown;
  tax_total?: unknown;
  lines?: unknown;
  disclaimer?: unknown;
}

interface WireHealthResponse {
  status?: unknown;
  version?: unknown;
  database_connected?: unknown;
}

interface WireStateCoverage {
  abbrev?: unknown;
  name?: unknown;
  has_sales_tax?: unknown;
  sst_member?: unknown;
  tier?: unknown;
  notes?: unknown;
}

interface WireStatesResponse {
  states?: unknown;
  total?: unknown;
}

interface WireRateStack {
  input?: unknown;
  jurisdictions?: unknown;
  combined_rate_pct?: unknown;
  disclaimer?: unknown;
}

function expectString(v: unknown, field: string): string {
  if (typeof v !== 'string') {
    throw new OpenSalesTaxValidationError(
      `Engine response field '${field}' is not a string (got ${typeof v})`,
    );
  }
  return v;
}

function expectBoolean(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') {
    throw new OpenSalesTaxValidationError(
      `Engine response field '${field}' is not a boolean (got ${typeof v})`,
    );
  }
  return v;
}

function expectNumber(v: unknown, field: string): number {
  if (typeof v !== 'number') {
    throw new OpenSalesTaxValidationError(
      `Engine response field '${field}' is not a number (got ${typeof v})`,
    );
  }
  return v;
}

function expectArray(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) {
    throw new OpenSalesTaxValidationError(
      `Engine response field '${field}' is not an array (got ${typeof v})`,
    );
  }
  return v as unknown[];
}

function expectObject(v: unknown, field: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new OpenSalesTaxValidationError(
      `Engine response field '${field}' is not an object`,
    );
  }
  return v as Record<string, unknown>;
}

function parseJurisdictionRate(raw: unknown, ctx: string): JurisdictionRate {
  const o = expectObject(raw, ctx) as WireJurisdictionRate;
  const tax = o.tax === null || o.tax === undefined ? null : expectString(o.tax, `${ctx}.tax`);
  return {
    name: expectString(o.name, `${ctx}.name`),
    type: expectString(o.type, `${ctx}.type`),
    ratePct: expectString(o.rate_pct, `${ctx}.rate_pct`),
    tax,
  };
}

export function parseHealthResponse(raw: unknown): HealthResponse {
  const o = expectObject(raw, 'health') as WireHealthResponse;
  return {
    status: expectString(o.status, 'status'),
    version: expectString(o.version, 'version'),
    databaseConnected: expectBoolean(o.database_connected, 'database_connected'),
  };
}

export function parseStatesResponse(raw: unknown): StatesResponse {
  const o = expectObject(raw, 'states-response') as WireStatesResponse;
  const arr = expectArray(o.states, 'states');
  const states: StateCoverage[] = arr.map((entry, i) => {
    const s = expectObject(entry, `states[${i}]`) as WireStateCoverage;
    return {
      abbrev: expectString(s.abbrev, `states[${i}].abbrev`),
      name: expectString(s.name, `states[${i}].name`),
      hasSalesTax: expectBoolean(s.has_sales_tax, `states[${i}].has_sales_tax`),
      sstMember: expectBoolean(s.sst_member, `states[${i}].sst_member`),
      tier: expectNumber(s.tier, `states[${i}].tier`),
      notes: typeof s.notes === 'string' ? s.notes : '',
    };
  });
  return {
    states,
    total: expectNumber(o.total, 'total'),
  };
}

export function parseRateStack(raw: unknown): RateStack {
  const o = expectObject(raw, 'rates') as WireRateStack;
  const input = expectObject(o.input, 'input');
  const zip5 = expectString(input.zip5, 'input.zip5');
  const zip4Raw = input.zip4;
  const zip4: string | null =
    zip4Raw === null || zip4Raw === undefined ? null : expectString(zip4Raw, 'input.zip4');
  const jurisdictions = expectArray(o.jurisdictions, 'jurisdictions').map((j, i) =>
    parseJurisdictionRate(j, `jurisdictions[${i}]`),
  );
  return {
    input: { zip5, zip4 },
    jurisdictions,
    combinedRatePct: expectString(o.combined_rate_pct, 'combined_rate_pct'),
    disclaimer: expectString(o.disclaimer, 'disclaimer'),
  };
}

function parseCalculatedLine(raw: unknown, ctx: string): CalculatedLine {
  const o = expectObject(raw, ctx) as WireCalculatedLine;
  const jurisdictions = expectArray(o.jurisdictions, `${ctx}.jurisdictions`).map(
    (j, i) => parseJurisdictionRate(j, `${ctx}.jurisdictions[${i}]`),
  );
  const note =
    o.note === null || o.note === undefined ? null : expectString(o.note, `${ctx}.note`);
  return {
    amount: expectString(o.amount, `${ctx}.amount`),
    category: expectString(o.category, `${ctx}.category`),
    tax: expectString(o.tax, `${ctx}.tax`),
    ratePct: expectString(o.rate_pct, `${ctx}.rate_pct`),
    jurisdictions,
    note,
  };
}

export function parseCalculationResult(raw: unknown): CalculationResult {
  const o = expectObject(raw, 'calculate') as WireCalculationResult;
  const lines = expectArray(o.lines, 'lines').map((line, i) =>
    parseCalculatedLine(line, `lines[${i}]`),
  );
  return {
    subtotal: expectString(o.subtotal, 'subtotal'),
    taxTotal: expectString(o.tax_total, 'tax_total'),
    lines,
    disclaimer: expectString(o.disclaimer, 'disclaimer'),
  };
}

/**
 * Build the wire-format body for `POST /v1/calculate`. Translates the
 * camelCase consumer-facing types into the snake_case keys the engine
 * expects.
 */
export function buildCalculateBody(
  address: Address,
  lineItems: LineItem[],
): { address: { zip5: string; zip4?: string }; line_items: { amount: string; category: string }[] } {
  const addr: { zip5: string; zip4?: string } = { zip5: address.zip5 };
  if (address.zip4 !== null && address.zip4 !== undefined && address.zip4 !== '') {
    addr.zip4 = address.zip4;
  }
  return {
    address: addr,
    line_items: lineItems.map((li) => ({
      amount: li.amount,
      category: li.category ?? 'general',
    })),
  };
}
