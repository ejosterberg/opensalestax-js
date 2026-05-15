// SPDX-License-Identifier: Apache-2.0

/**
 * Flat error hierarchy for the OpenSalesTax SDK.
 *
 * Mirrors the Python SDK's `errors.py` so connectors written against
 * one SDK feel familiar in the other. Consumers typically catch:
 *
 *  - `OpenSalesTaxNetworkError` — fail-soft (engine down, retry later)
 *  - `OpenSalesTaxAPIError` 4xx — config / data issue, surface to operator
 *  - `OpenSalesTaxAPIError` 5xx — fail-soft (engine glitch)
 *  - `NonUSDError` — opt out cleanly (non-US partner / non-US position)
 *  - `OpenSalesTaxValidationError` — engine/SDK version drift, escalate
 */

export class OpenSalesTaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenSalesTaxError';
  }
}

/**
 * Anything below the HTTP layer — timeout, DNS resolution failure,
 * connection refused, TLS handshake failure.
 */
export class OpenSalesTaxNetworkError extends OpenSalesTaxError {
  constructor(message: string) {
    super(message);
    this.name = 'OpenSalesTaxNetworkError';
  }
}

/**
 * The engine returned a non-2xx HTTP response. `statusCode` holds the
 * raw HTTP status; `responseBody` holds the parsed JSON (or `null` if
 * the body wasn't JSON).
 */
export class OpenSalesTaxAPIError extends OpenSalesTaxError {
  public readonly statusCode: number;
  public readonly responseBody: unknown;

  constructor(statusCode: number, message: string, responseBody?: unknown) {
    super(`OpenSalesTax API ${statusCode}: ${message}`);
    this.name = 'OpenSalesTaxAPIError';
    this.statusCode = statusCode;
    this.responseBody = responseBody ?? null;
  }
}

/**
 * The response shape didn't match the SDK's expected models. Almost
 * always means engine vs. SDK version drift — escalate, don't retry.
 */
export class OpenSalesTaxValidationError extends OpenSalesTaxError {
  constructor(message: string) {
    super(message);
    this.name = 'OpenSalesTaxValidationError';
  }
}

/**
 * The consumer passed a non-USD amount or non-US address. The engine
 * is USD-only by design; this lets connectors opt out cleanly when
 * they detect e.g. a EUR cart upstream.
 */
export class NonUSDError extends OpenSalesTaxValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'NonUSDError';
  }
}
