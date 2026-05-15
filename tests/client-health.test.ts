// SPDX-License-Identifier: Apache-2.0

import { OpenSalesTaxClient, type FetchFn } from '../src/client';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('OpenSalesTaxClient.health', () => {
  it('parses the engine health payload', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(
        jsonResponse({
          status: 'ok',
          version: '0.55.4',
          database_connected: true,
        }),
      );
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const out = await c.health();
    expect(out).toEqual({
      status: 'ok',
      version: '0.55.4',
      databaseConnected: true,
    });
  });
});

describe('OpenSalesTaxClient.healthCheck (never-throws)', () => {
  it('returns ok:true when engine reports healthy', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(
        jsonResponse({
          status: 'ok',
          version: '0.55.4',
          database_connected: true,
        }),
      );
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const h = await c.healthCheck();
    expect(h.ok).toBe(true);
    if (h.ok) {
      expect(h.version).toBe('0.55.4');
      expect(h.databaseConnected).toBe(true);
      expect(typeof h.rttMs).toBe('number');
    }
  });

  it('returns ok:false when database_connected is false', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(
        jsonResponse({
          status: 'ok',
          version: 'x',
          database_connected: false,
        }),
      );
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const h = await c.healthCheck();
    expect(h.ok).toBe(false);
    if (!h.ok) {
      expect(h.error).toContain('databaseConnected=false');
    }
  });

  it('returns ok:false when status is not "ok"', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(
        jsonResponse({
          status: 'degraded',
          version: 'x',
          database_connected: true,
        }),
      );
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const h = await c.healthCheck();
    expect(h.ok).toBe(false);
    if (!h.ok) {
      expect(h.error).toContain('status=degraded');
    }
  });

  it('returns ok:false on network error and never throws', async () => {
    const mockFetch: FetchFn = () => Promise.reject(new Error('ECONNREFUSED'));
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const h = await c.healthCheck();
    expect(h.ok).toBe(false);
    if (!h.ok) {
      expect(h.error).toContain('ECONNREFUSED');
      expect(typeof h.rttMs).toBe('number');
    }
  });

  it('returns ok:false on HTTP 500 and never throws', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(new Response('oops', { status: 500 }));
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      fetch: mockFetch,
    });
    const h = await c.healthCheck();
    expect(h.ok).toBe(false);
  });
});
