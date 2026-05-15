// SPDX-License-Identifier: Apache-2.0

import { OpenSalesTaxClient, type FetchFn } from '../src/client';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const sampleCalculation = {
  subtotal: '100.00',
  tax_total: '9.03',
  lines: [
    {
      amount: '100.00',
      category: 'general',
      tax: '9.03',
      rate_pct: '9.02500',
      jurisdictions: [
        { name: 'Minnesota', type: 'state', rate_pct: '6.87500', tax: '6.88' },
        { name: 'Hennepin County', type: 'county', rate_pct: '0.15000', tax: '0.15' },
        { name: 'Minneapolis', type: 'city', rate_pct: '0.50000', tax: '0.50' },
      ],
      note: null,
    },
  ],
  disclaimer: 'Calculation only.',
};

describe('OpenSalesTaxClient.calculate', () => {
  it('POSTs to /v1/calculate with snake_case body', async () => {
    let seenUrl = '';
    let seenBody: unknown = undefined;
    const mockFetch: FetchFn = (input, init) => {
      seenUrl = String(input);
      const raw = init?.body;
      seenBody = typeof raw === 'string' ? JSON.parse(raw) : undefined;
      return Promise.resolve(jsonResponse(sampleCalculation));
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });

    const out = await c.calculate({ zip5: '55401' }, [
      { amount: '100.00', category: 'general' },
    ]);

    expect(seenUrl).toBe('http://engine.example.com:8080/v1/calculate');
    expect(seenBody).toEqual({
      address: { zip5: '55401' },
      line_items: [{ amount: '100.00', category: 'general' }],
    });
    expect(out.subtotal).toBe('100.00');
    expect(out.taxTotal).toBe('9.03');
    expect(out.lines[0]?.ratePct).toBe('9.02500');
    expect(out.lines[0]?.jurisdictions).toHaveLength(3);
  });

  it('sets Content-Type: application/json on the POST', async () => {
    let contentType: string | null = null;
    const mockFetch: FetchFn = (_url, init) => {
      contentType = new Headers(init?.headers).get('content-type');
      return Promise.resolve(jsonResponse(sampleCalculation));
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    await c.calculate({ zip5: '55401' }, [{ amount: '100.00' }]);
    expect(contentType).toBe('application/json');
  });

  it('handles an empty line_items list', async () => {
    let seenBody: unknown = undefined;
    const mockFetch: FetchFn = (_url, init) => {
      const raw = init?.body;
      seenBody = typeof raw === 'string' ? JSON.parse(raw) : undefined;
      return Promise.resolve(
        jsonResponse({
          subtotal: '0.00',
          tax_total: '0.00',
          lines: [],
          disclaimer: '',
        }),
      );
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const out = await c.calculate({ zip5: '55401' }, []);
    expect(seenBody).toEqual({
      address: { zip5: '55401' },
      line_items: [],
    });
    expect(out.taxTotal).toBe('0.00');
  });

  it('passes zip4 through to the request body', async () => {
    let seenBody: unknown = undefined;
    const mockFetch: FetchFn = (_url, init) => {
      const raw = init?.body;
      seenBody = typeof raw === 'string' ? JSON.parse(raw) : undefined;
      return Promise.resolve(jsonResponse(sampleCalculation));
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    await c.calculate({ zip5: '55401', zip4: '1234' }, [
      { amount: '100.00', category: 'general' },
    ]);
    expect(seenBody).toEqual({
      address: { zip5: '55401', zip4: '1234' },
      line_items: [{ amount: '100.00', category: 'general' }],
    });
  });

  it('defaults category to "general" when omitted', async () => {
    let seenBody: unknown = undefined;
    const mockFetch: FetchFn = (_url, init) => {
      const raw = init?.body;
      seenBody = typeof raw === 'string' ? JSON.parse(raw) : undefined;
      return Promise.resolve(jsonResponse(sampleCalculation));
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    await c.calculate({ zip5: '55401' }, [{ amount: '100.00' }]);
    const body = seenBody as { line_items: { category: string }[] };
    expect(body.line_items[0]?.category).toBe('general');
  });
});
