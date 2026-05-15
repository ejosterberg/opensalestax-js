// SPDX-License-Identifier: Apache-2.0

import { OpenSalesTaxClient, type FetchFn } from '../src/client';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const sampleRateStack = {
  input: { zip5: '55401', zip4: null },
  jurisdictions: [
    { name: 'Minnesota', type: 'state', rate_pct: '6.87500', tax: null },
    { name: 'Hennepin County', type: 'county', rate_pct: '0.15000', tax: null },
  ],
  combined_rate_pct: '7.02500',
  disclaimer: 'Calculation only.',
};

describe('OpenSalesTaxClient.rates', () => {
  it('GETs /v1/rates with zip5 only', async () => {
    const seenUrls: string[] = [];
    const mockFetch: FetchFn = (input) => {
      seenUrls.push(String(input));
      return Promise.resolve(jsonResponse(sampleRateStack));
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const out = await c.rates('55401');
    expect(seenUrls[0]).toBe('http://engine.example.com:8080/v1/rates?zip5=55401');
    expect(out.combinedRatePct).toBe('7.02500');
    expect(out.jurisdictions[0]?.ratePct).toBe('6.87500');
  });

  it('includes zip4 in the query string when provided', async () => {
    const seenUrls: string[] = [];
    const mockFetch: FetchFn = (input) => {
      seenUrls.push(String(input));
      return Promise.resolve(
        jsonResponse({ ...sampleRateStack, input: { zip5: '55401', zip4: '1234' } }),
      );
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const out = await c.rates('55401', '1234');
    expect(seenUrls[0]).toBe(
      'http://engine.example.com:8080/v1/rates?zip5=55401&zip4=1234',
    );
    expect(out.input.zip4).toBe('1234');
  });

  it('omits zip4 when null / empty', async () => {
    const seenUrls: string[] = [];
    const mockFetch: FetchFn = (input) => {
      seenUrls.push(String(input));
      return Promise.resolve(jsonResponse(sampleRateStack));
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    await c.rates('55401', null);
    await c.rates('55401', '');
    expect(seenUrls[0]).toBe('http://engine.example.com:8080/v1/rates?zip5=55401');
    expect(seenUrls[1]).toBe('http://engine.example.com:8080/v1/rates?zip5=55401');
  });
});
