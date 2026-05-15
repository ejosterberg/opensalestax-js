// SPDX-License-Identifier: Apache-2.0

import {
  NonUSDError,
  OpenSalesTaxAPIError,
  OpenSalesTaxError,
  OpenSalesTaxNetworkError,
  OpenSalesTaxValidationError,
} from '../src/errors';

describe('error hierarchy', () => {
  it('OpenSalesTaxError is the base', () => {
    const e = new OpenSalesTaxError('boom');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('boom');
    expect(e.name).toBe('OpenSalesTaxError');
  });

  it('OpenSalesTaxNetworkError extends OpenSalesTaxError', () => {
    const e = new OpenSalesTaxNetworkError('timeout');
    expect(e).toBeInstanceOf(OpenSalesTaxError);
    expect(e.name).toBe('OpenSalesTaxNetworkError');
  });

  it('OpenSalesTaxAPIError carries statusCode + responseBody', () => {
    const e = new OpenSalesTaxAPIError(500, 'engine glitch', { detail: 'x' });
    expect(e).toBeInstanceOf(OpenSalesTaxError);
    expect(e.statusCode).toBe(500);
    expect(e.responseBody).toEqual({ detail: 'x' });
    expect(e.message).toContain('500');
    expect(e.message).toContain('engine glitch');
  });

  it('OpenSalesTaxAPIError defaults responseBody to null', () => {
    const e = new OpenSalesTaxAPIError(400, 'bad request');
    expect(e.responseBody).toBeNull();
  });

  it('OpenSalesTaxValidationError extends OpenSalesTaxError', () => {
    const e = new OpenSalesTaxValidationError('mismatch');
    expect(e).toBeInstanceOf(OpenSalesTaxError);
    expect(e.name).toBe('OpenSalesTaxValidationError');
  });

  it('NonUSDError extends OpenSalesTaxValidationError', () => {
    const e = new NonUSDError('EUR not supported');
    expect(e).toBeInstanceOf(OpenSalesTaxValidationError);
    expect(e).toBeInstanceOf(OpenSalesTaxError);
    expect(e.name).toBe('NonUSDError');
  });
});
