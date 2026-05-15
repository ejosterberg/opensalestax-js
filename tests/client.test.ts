// SPDX-License-Identifier: Apache-2.0

import { OpenSalesTaxClient, type FetchFn } from '../src/client';
import {
  OpenSalesTaxAPIError,
  OpenSalesTaxNetworkError,
  OpenSalesTaxValidationError,
} from '../src/errors';
import { UrlValidationError } from '../src/url';

/** Builds a Response-shaped object for a JSON body. */
function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function clientWith(fetchImpl: FetchFn): OpenSalesTaxClient {
  return new OpenSalesTaxClient({
    baseUrl: 'http://engine.example.com:8080',
    fetch: fetchImpl,
    timeoutMs: 1000,
  });
}

describe('OpenSalesTaxClient construction', () => {
  it('refuses RFC-1918 base URL without allowPrivate', () => {
    expect(
      () => new OpenSalesTaxClient({ baseUrl: 'http://10.32.161.126:8080' }),
    ).toThrow(UrlValidationError);
  });

  it('accepts RFC-1918 base URL with allowPrivate', () => {
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://10.32.161.126:8080',
      allowPrivate: true,
      fetch: jest.fn(),
    });
    expect(c).toBeInstanceOf(OpenSalesTaxClient);
  });

  it('strips trailing slashes from baseUrl', async () => {
    const seen: string[] = [];
    const mockFetch: FetchFn = (input) => {
      seen.push(String(input));
      return Promise.resolve(
        jsonResponse({ status: 'ok', version: 'x', database_connected: true }),
      );
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080///',
      fetch: mockFetch,
    });
    await c.health();
    expect(seen[0]).toBe('http://engine.example.com:8080/v1/health');
  });

  it('throws when no fetch is available and none is injected', () => {
    const originalFetch = (globalThis as { fetch?: unknown }).fetch;
    try {
      (globalThis as { fetch?: unknown }).fetch = undefined;
      expect(
        () =>
          new OpenSalesTaxClient({ baseUrl: 'http://engine.example.com:8080' }),
      ).toThrow(OpenSalesTaxValidationError);
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
  });

  it('uses globalThis.fetch when none injected', async () => {
    const original = globalThis.fetch;
    const spy = jest
      .fn<Promise<Response>, [string | URL | Request, RequestInit | undefined]>()
      .mockResolvedValue(
        jsonResponse({ status: 'ok', version: 'x', database_connected: true }),
      );
    (globalThis as { fetch: unknown }).fetch = spy;
    try {
      const c = new OpenSalesTaxClient({ baseUrl: 'http://engine.example.com:8080' });
      await c.health();
      expect(spy).toHaveBeenCalled();
    } finally {
      (globalThis as { fetch: unknown }).fetch = original;
    }
  });

  it('close() is a no-op', () => {
    const c = clientWith(jest.fn());
    expect(() => c.close()).not.toThrow();
  });
});

describe('OpenSalesTaxClient request headers', () => {
  it('omits Authorization when no apiKey is given', async () => {
    let captured: Headers | null = null;
    const mockFetch: FetchFn = (_url, init) => {
      captured = new Headers(init?.headers);
      return Promise.resolve(
        jsonResponse({ status: 'ok', version: 'x', database_connected: true }),
      );
    };
    const c = clientWith(mockFetch);
    await c.health();
    expect(captured).not.toBeNull();
    expect((captured as unknown as Headers).get('authorization')).toBeNull();
  });

  it('sends Authorization: Bearer when apiKey is set', async () => {
    let captured: Headers | null = null;
    const mockFetch: FetchFn = (_url, init) => {
      captured = new Headers(init?.headers);
      return Promise.resolve(
        jsonResponse({ status: 'ok', version: 'x', database_connected: true }),
      );
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      apiKey: 'k-secret',
      fetch: mockFetch,
    });
    await c.health();
    expect(captured).not.toBeNull();
    expect((captured as unknown as Headers).get('authorization')).toBe(
      'Bearer k-secret',
    );
  });

  it('omits Authorization when apiKey is empty string', async () => {
    let captured: Headers | null = null;
    const mockFetch: FetchFn = (_url, init) => {
      captured = new Headers(init?.headers);
      return Promise.resolve(
        jsonResponse({ status: 'ok', version: 'x', database_connected: true }),
      );
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      apiKey: '',
      fetch: mockFetch,
    });
    await c.health();
    expect(captured).not.toBeNull();
    expect((captured as unknown as Headers).get('authorization')).toBeNull();
  });

  it('sends a User-Agent with package version', async () => {
    let captured: Headers | null = null;
    const mockFetch: FetchFn = (_url, init) => {
      captured = new Headers(init?.headers);
      return Promise.resolve(
        jsonResponse({ status: 'ok', version: 'x', database_connected: true }),
      );
    };
    const c = clientWith(mockFetch);
    await c.health();
    const ua = (captured as unknown as Headers).get('user-agent') ?? '';
    expect(ua).toMatch(/opensalestax-js\/\d/);
  });

  it('appends a custom userAgent suffix when provided', async () => {
    let captured: Headers | null = null;
    const mockFetch: FetchFn = (_url, init) => {
      captured = new Headers(init?.headers);
      return Promise.resolve(
        jsonResponse({ status: 'ok', version: 'x', database_connected: true }),
      );
    };
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      userAgent: 'my-app/1.0',
      fetch: mockFetch,
    });
    await c.health();
    const ua = (captured as unknown as Headers).get('user-agent') ?? '';
    expect(ua).toMatch(/opensalestax-js\/\d/);
    expect(ua).toContain('my-app/1.0');
  });

  it('omits Content-Type on GET requests with no body', async () => {
    let captured: Headers | null = null;
    const mockFetch: FetchFn = (_url, init) => {
      captured = new Headers(init?.headers);
      return Promise.resolve(
        jsonResponse({ status: 'ok', version: 'x', database_connected: true }),
      );
    };
    const c = clientWith(mockFetch);
    await c.health();
    expect((captured as unknown as Headers).get('content-type')).toBeNull();
  });
});

describe('OpenSalesTaxClient error paths', () => {
  it('wraps fetch failures as OpenSalesTaxNetworkError', async () => {
    const mockFetch: FetchFn = () => Promise.reject(new Error('ECONNREFUSED'));
    const c = clientWith(mockFetch);
    await expect(c.health()).rejects.toThrow(OpenSalesTaxNetworkError);
  });

  it('wraps abort/timeout as OpenSalesTaxNetworkError', async () => {
    const mockFetch: FetchFn = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    const c = new OpenSalesTaxClient({
      baseUrl: 'http://engine.example.com:8080',
      timeoutMs: 10,
      fetch: mockFetch,
    });
    await expect(c.health()).rejects.toThrow(OpenSalesTaxNetworkError);
  });

  it('throws OpenSalesTaxAPIError on HTTP 500', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(
        new Response('boom', { status: 500, statusText: 'Server Error' }),
      );
    const c = clientWith(mockFetch);
    await expect(c.health()).rejects.toThrow(OpenSalesTaxAPIError);
  });

  it('OpenSalesTaxAPIError carries statusCode + responseBody from JSON detail', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: 'invalid zip' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const c = clientWith(mockFetch);
    try {
      await c.health();
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OpenSalesTaxAPIError);
      const e = err as OpenSalesTaxAPIError;
      expect(e.statusCode).toBe(400);
      expect(e.message).toContain('invalid zip');
      expect(e.responseBody).toEqual({ detail: 'invalid zip' });
    }
  });

  it('handles non-string detail field gracefully', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: { code: 'bad' } }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const c = clientWith(mockFetch);
    await expect(c.health()).rejects.toThrow(/422/);
  });

  it('falls back to status text when body is empty', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(new Response('', { status: 502, statusText: 'Bad Gateway' }));
    const c = clientWith(mockFetch);
    await expect(c.health()).rejects.toThrow(/Bad Gateway/);
  });

  it('throws OpenSalesTaxValidationError on malformed JSON', async () => {
    const mockFetch: FetchFn = () =>
      Promise.resolve(
        new Response('{not json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const c = clientWith(mockFetch);
    await expect(c.health()).rejects.toThrow(OpenSalesTaxValidationError);
  });
});
