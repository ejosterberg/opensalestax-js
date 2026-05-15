// SPDX-License-Identifier: Apache-2.0

import { OpenSalesTaxValidationError } from '../src/errors';
import {
  buildCalculateBody,
  parseCalculationResult,
  parseHealthResponse,
  parseRateStack,
  parseStatesResponse,
} from '../src/models';

describe('parseHealthResponse', () => {
  it('translates snake_case to camelCase', () => {
    const out = parseHealthResponse({
      status: 'ok',
      version: '0.55.4',
      database_connected: true,
    });
    expect(out).toEqual({
      status: 'ok',
      version: '0.55.4',
      databaseConnected: true,
    });
  });

  it('throws on missing database_connected', () => {
    expect(() => parseHealthResponse({ status: 'ok', version: 'x' })).toThrow(
      OpenSalesTaxValidationError,
    );
  });

  it('throws on non-object', () => {
    expect(() => parseHealthResponse(null)).toThrow(OpenSalesTaxValidationError);
    expect(() => parseHealthResponse('a string')).toThrow(
      OpenSalesTaxValidationError,
    );
    expect(() => parseHealthResponse([])).toThrow(OpenSalesTaxValidationError);
  });
});

describe('parseStatesResponse', () => {
  it('returns camelCased per-state entries', () => {
    const out = parseStatesResponse({
      states: [
        {
          abbrev: 'MN',
          name: 'Minnesota',
          has_sales_tax: true,
          sst_member: true,
          tier: 1,
          notes: '',
        },
      ],
      total: 1,
    });
    expect(out.total).toBe(1);
    expect(out.states[0]).toEqual({
      abbrev: 'MN',
      name: 'Minnesota',
      hasSalesTax: true,
      sstMember: true,
      tier: 1,
      notes: '',
    });
  });

  it('defaults notes to empty string when missing', () => {
    const out = parseStatesResponse({
      states: [
        {
          abbrev: 'MN',
          name: 'Minnesota',
          has_sales_tax: true,
          sst_member: false,
          tier: 1,
        },
      ],
      total: 1,
    });
    expect(out.states[0]?.notes).toBe('');
  });

  it('throws on non-array states field', () => {
    expect(() => parseStatesResponse({ states: 'oops', total: 0 })).toThrow(
      OpenSalesTaxValidationError,
    );
  });
});

describe('parseRateStack', () => {
  it('translates the rates wire format', () => {
    const out = parseRateStack({
      input: { zip5: '55401', zip4: null },
      jurisdictions: [
        { name: 'Minnesota', type: 'state', rate_pct: '6.87500', tax: null },
        { name: 'Hennepin County', type: 'county', rate_pct: '0.15000', tax: null },
      ],
      combined_rate_pct: '9.02500',
      disclaimer: 'Calculation only.',
    });
    expect(out.input.zip5).toBe('55401');
    expect(out.input.zip4).toBeNull();
    expect(out.jurisdictions).toHaveLength(2);
    expect(out.jurisdictions[0]).toEqual({
      name: 'Minnesota',
      type: 'state',
      ratePct: '6.87500',
      tax: null,
    });
    expect(out.combinedRatePct).toBe('9.02500');
  });

  it('handles a zip4 value', () => {
    const out = parseRateStack({
      input: { zip5: '55401', zip4: '1234' },
      jurisdictions: [],
      combined_rate_pct: '0.00000',
      disclaimer: '',
    });
    expect(out.input.zip4).toBe('1234');
  });

  it('throws on missing combined_rate_pct', () => {
    expect(() =>
      parseRateStack({
        input: { zip5: '55401', zip4: null },
        jurisdictions: [],
        disclaimer: '',
      }),
    ).toThrow(OpenSalesTaxValidationError);
  });
});

describe('parseCalculationResult', () => {
  const sample = {
    subtotal: '100.00',
    tax_total: '9.03',
    lines: [
      {
        amount: '100.00',
        category: 'general',
        tax: '9.03',
        rate_pct: '9.02500',
        jurisdictions: [
          {
            name: 'Minnesota',
            type: 'state',
            rate_pct: '6.87500',
            tax: '6.88',
          },
          {
            name: 'Minneapolis',
            type: 'city',
            rate_pct: '0.50000',
            tax: '0.50',
          },
        ],
        note: null,
      },
    ],
    disclaimer: 'Calculation only.',
  };

  it('translates the full wire format', () => {
    const out = parseCalculationResult(sample);
    expect(out.subtotal).toBe('100.00');
    expect(out.taxTotal).toBe('9.03');
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]?.ratePct).toBe('9.02500');
    expect(out.lines[0]?.jurisdictions[0]).toEqual({
      name: 'Minnesota',
      type: 'state',
      ratePct: '6.87500',
      tax: '6.88',
    });
    expect(out.lines[0]?.note).toBeNull();
  });

  it('preserves a string note', () => {
    const withNote = {
      ...sample,
      lines: [{ ...sample.lines[0], note: 'rounded down' }],
    };
    const out = parseCalculationResult(withNote);
    expect(out.lines[0]?.note).toBe('rounded down');
  });

  it('throws when lines is missing', () => {
    const bad = {
      subtotal: '0.00',
      tax_total: '0.00',
      disclaimer: '',
    };
    expect(() => parseCalculationResult(bad)).toThrow(OpenSalesTaxValidationError);
  });

  it('throws when a jurisdiction is missing rate_pct', () => {
    const bad = {
      ...sample,
      lines: [
        {
          ...sample.lines[0],
          jurisdictions: [{ name: 'X', type: 'state', tax: '0.00' }],
        },
      ],
    };
    expect(() => parseCalculationResult(bad)).toThrow(OpenSalesTaxValidationError);
  });
});

describe('buildCalculateBody', () => {
  it('emits snake_case keys', () => {
    const body = buildCalculateBody(
      { zip5: '55401' },
      [{ amount: '100.00', category: 'general' }],
    );
    expect(body).toEqual({
      address: { zip5: '55401' },
      line_items: [{ amount: '100.00', category: 'general' }],
    });
  });

  it('defaults missing category to "general"', () => {
    const body = buildCalculateBody({ zip5: '55401' }, [{ amount: '100.00' }]);
    expect(body.line_items[0]).toEqual({ amount: '100.00', category: 'general' });
  });

  it('includes zip4 when provided', () => {
    const body = buildCalculateBody({ zip5: '55401', zip4: '1234' }, []);
    expect(body.address).toEqual({ zip5: '55401', zip4: '1234' });
  });

  it('omits zip4 when null / undefined / empty', () => {
    expect(buildCalculateBody({ zip5: '55401', zip4: null }, []).address).toEqual({ zip5: '55401' });
    expect(buildCalculateBody({ zip5: '55401' }, []).address).toEqual({ zip5: '55401' });
    expect(buildCalculateBody({ zip5: '55401', zip4: '' }, []).address).toEqual({ zip5: '55401' });
  });
});
