// SPDX-License-Identifier: Apache-2.0

import { OpenSalesTaxClient, type FetchFn } from '../src/client';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OpenSalesTaxClient.states', () => {
  it('GETs /v1/states and returns camelCased entries', async () => {
    const seenUrls: string[] = [];
    const mockFetch: FetchFn = (input) => {
      seenUrls.push(String(input));
      return Promise.resolve(
        jsonResponse({
          states: [
            {
              abbrev: 'MN',
              name: 'Minnesota',
              has_sales_tax: true,
              sst_member: true,
              tier: 1,
              notes: '',
            },
            {
              abbrev: 'OR',
              name: 'Oregon',
              has_sales_tax: false,
              sst_member: false,
              tier: 1,
              notes: '',
            },
          ],
          total: 2,
        }),
      );
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const out = await c.states();
    expect(seenUrls[0]).toBe('http://engine.example.com:8080/v1/states');
    expect(out.total).toBe(2);
    expect(out.states[0]?.abbrev).toBe('MN');
    expect(out.states[1]?.hasSalesTax).toBe(false);
  });
});
