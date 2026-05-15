// SPDX-License-Identifier: Apache-2.0

/**
 * Public API for `@ejosterberg/opensalestax`.
 *
 * Consumers import everything they need from this single entry point:
 *
 * ```ts
 * import {
 *   OpenSalesTaxClient,
 *   type Address,
 *   type LineItem,
 *   OpenSalesTaxNetworkError,
 * } from '@ejosterberg/opensalestax';
 * ```
 */

export { OpenSalesTaxClient } from './client.js';
export type {
  FetchFn,
  HealthCheckResult,
  OpenSalesTaxClientOptions,
} from './client.js';

export type {
  Address,
  CalculatedLine,
  CalculationResult,
  HealthResponse,
  JurisdictionRate,
  JurisdictionType,
  LineItem,
  RateStack,
  StateCoverage,
  StatesResponse,
} from './models.js';

export {
  NonUSDError,
  OpenSalesTaxAPIError,
  OpenSalesTaxError,
  OpenSalesTaxNetworkError,
  OpenSalesTaxValidationError,
} from './errors.js';

export {
  UrlValidationError,
  stripTrailingSlashes,
  validateEngineUrl,
} from './url.js';

export { VERSION } from './version.js';
