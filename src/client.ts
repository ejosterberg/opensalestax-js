// SPDX-License-Identifier: Apache-2.0

/**
 * OpenSalesTaxClient — thin TypeScript wrapper over the OpenSalesTax v1
 * HTTP API.
 *
 * Mirrors the Python SDK's `OpenSalesTaxClient` surface
 * (`health`, `states`, `rates`, `calculate`) and the PHP SDK's. Returns
 * camelCase property objects regardless of the engine's snake_case
 * wire format.
 *
 * No runtime dependencies — uses built-in `fetch`, `URL`, and
 * `AbortController` (Node 20+).
 */

import {
  OpenSalesTaxAPIError,
  OpenSalesTaxNetworkError,
  OpenSalesTaxValidationError,
} from './errors.js';
import {
  buildCalculateBody,
  parseCalculationResult,
  parseHealthResponse,
  parseRateStack,
  parseStatesResponse,
  type Address,
  type CalculationResult,
  type HealthResponse,
  type LineItem,
  type RateStack,
  type StatesResponse,
} from './models.js';
import { stripTrailingSlashes, validateEngineUrl } from './url.js';
import { VERSION } from './version.js';

const DEFAULT_TIMEOUT_MS = 10_000;

/** A `fetch`-shaped function. Injected for unit tests. */
export type FetchFn = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenSalesTaxClientOptions {
  /** Base URL of the engine, e.g. `"http://10.32.161.126:8080"`. */
  baseUrl: string;
  /** Optional API key; sent as `Authorization: Bearer <key>`. */
  apiKey?: string | null;
  /** Per-request timeout in milliseconds. Default 10_000. */
  timeoutMs?: number;
  /** Suffix appended to the SDK's default User-Agent header. */
  userAgent?: string | null;
  /** When false, skip TLS verification (dev only — engine self-signed cert). Default true. */
  verify?: boolean;
  /**
   * Permit loopback / RFC-1918 / link-local engine URLs. Default false.
   * Set to true for dev or merchants running the engine on a private
   * network (e.g. inside the same Docker compose stack).
   */
  allowPrivate?: boolean;
  /**
   * Inject a `fetch` implementation. Defaults to `globalThis.fetch`.
   * Useful for unit tests, polyfills, and HTTP instrumentation.
   */
  fetch?: FetchFn;
}

interface HealthCheckSuccess {
  ok: true;
  version: string;
  databaseConnected: boolean;
  rttMs: number;
}

interface HealthCheckFailure {
  ok: false;
  rttMs: number;
  error: string;
}

/**
 * Result of the convenience `healthCheck()` wrapper — never throws.
 * Used by connector startup probes that want to log-and-continue
 * rather than crash on engine-unreachable.
 */
export type HealthCheckResult = HealthCheckSuccess | HealthCheckFailure;

export class OpenSalesTaxClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly fetchImpl: FetchFn;

  constructor(options: OpenSalesTaxClientOptions) {
    // SSRF defense. Defaults to public-only; opt in to private nets.
    validateEngineUrl(options.baseUrl, {
      allowPrivate: options.allowPrivate === true,
    });
    this.baseUrl = stripTrailingSlashes(options.baseUrl);
    this.apiKey = options.apiKey ?? null;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const baseUa = `opensalestax-js/${VERSION}`;
    this.userAgent =
      options.userAgent !== null && options.userAgent !== undefined && options.userAgent !== ''
        ? `${baseUa} ${options.userAgent}`
        : baseUa;

    // The `verify` flag is reserved for parity with the Python SDK.
    // Browsers and Node's built-in fetch don't expose a per-request
    // TLS verify toggle without an Agent; supporting it here would
    // require pulling in `undici` or `https.Agent`. For v0.1 the
    // option is intentionally accepted-but-not-acted-upon; consumers
    // that need to disable TLS verification inject a custom `fetch`
    // built on undici's Agent (documented in README).
    // Touching the field below keeps strict TS + lint happy and makes
    // the intent explicit at code review.
    if (options.verify === false) {
      // Currently a no-op; placeholder for v0.2's undici Agent wiring.
    }

    const injected = options.fetch;
    if (injected !== undefined) {
      this.fetchImpl = injected;
    } else if (typeof globalThis.fetch === 'function') {
      // Bind to globalThis so the implementation keeps its `this`.
      this.fetchImpl = globalThis.fetch.bind(globalThis);
    } else {
      throw new OpenSalesTaxValidationError(
        'No fetch implementation available. Pass `fetch` via constructor options or run on Node 20+.',
      );
    }
  }

  /** No-op close hook for parity with the Python SDK's context-manager API. */
  close(): void {
    // built-in fetch has no connection pool the SDK owns; nothing to do
  }

  /** GET /v1/health — liveness + DB-connection check. */
  async health(): Promise<HealthResponse> {
    const raw = await this.requestJSON('GET', '/v1/health');
    return parseHealthResponse(raw);
  }

  /** GET /v1/states — coverage tier per state. */
  async states(): Promise<StatesResponse> {
    const raw = await this.requestJSON('GET', '/v1/states');
    return parseStatesResponse(raw);
  }

  /** GET /v1/rates?zip5=...&zip4=... — rate stack only (no calculation). */
  async rates(zip5: string, zip4?: string | null): Promise<RateStack> {
    const qs = new URLSearchParams({ zip5 });
    if (zip4 !== null && zip4 !== undefined && zip4 !== '') {
      qs.set('zip4', zip4);
    }
    const raw = await this.requestJSON('GET', `/v1/rates?${qs.toString()}`);
    return parseRateStack(raw);
  }

  /** POST /v1/calculate — full per-line, per-jurisdiction calculation. */
  async calculate(
    address: Address,
    lineItems: LineItem[],
  ): Promise<CalculationResult> {
    const body = buildCalculateBody(address, lineItems);
    const raw = await this.requestJSON('POST', '/v1/calculate', body);
    return parseCalculationResult(raw);
  }

  /**
   * Liveness probe wrapper with RTT measurement and never-throws
   * contract. Used by connector startup probes that want to log a
   * warning and continue booting rather than crash on engine-down.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const h = await this.health();
      const rttMs = Date.now() - start;
      if (h.status === 'ok' && h.databaseConnected) {
        return { ok: true, version: h.version, databaseConnected: true, rttMs };
      }
      return {
        ok: false,
        rttMs,
        error: `Engine reports status=${h.status} databaseConnected=${String(h.databaseConnected)}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, rttMs: Date.now() - start, error: message };
    }
  }

  // --- internals ----------------------------------------------------

  private buildHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': this.userAgent,
    };
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.apiKey !== null && this.apiKey !== '') {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async sendRequest(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);
    init.signal = controller.signal;
    try {
      return await this.fetchImpl(url, init);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new OpenSalesTaxNetworkError(
        `Network error contacting OpenSalesTax engine at ${this.baseUrl}: ${message}`,
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const text = await response.text().catch(() => '');
    const { messageText, parsedBody } = extractErrorMessage(text);
    const finalMessage =
      messageText === '' ? response.statusText || '(no body)' : messageText;
    throw new OpenSalesTaxAPIError(response.status, finalMessage, parsedBody);
  }

  private async parseSuccessBody(response: Response): Promise<unknown> {
    let text: string;
    try {
      text = await response.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new OpenSalesTaxValidationError(
        `Failed to read OpenSalesTax engine response body: ${message}`,
      );
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new OpenSalesTaxValidationError(
        `OpenSalesTax engine returned malformed JSON: ${message}`,
      );
    }
  }

  private async requestJSON(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: this.buildHeaders(body !== undefined),
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await this.sendRequest(url, init);

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return this.parseSuccessBody(response);
  }
}

/**
 * Pull a useful error message and the parsed body out of an engine
 * non-2xx response. Tries JSON `detail` field first, falls back to
 * raw text truncated to 200 chars.
 */
function extractErrorMessage(text: string): {
  messageText: string;
  parsedBody: unknown;
} {
  if (text === '') {
    return { messageText: '', parsedBody: null };
  }
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(text);
  } catch {
    return { messageText: text.slice(0, 200), parsedBody: null };
  }
  if (typeof parsedBody !== 'object' || parsedBody === null) {
    return { messageText: '', parsedBody };
  }
  const detail = (parsedBody as Record<string, unknown>)['detail'];
  if (typeof detail === 'string') {
    return { messageText: detail, parsedBody };
  }
  if (detail !== undefined && detail !== null) {
    return { messageText: JSON.stringify(detail), parsedBody };
  }
  return { messageText: '', parsedBody };
}
