// SPDX-License-Identifier: Apache-2.0

import {
  UrlValidationError,
  stripTrailingSlashes,
  validateEngineUrl,
} from '../src/url';

describe('validateEngineUrl', () => {
  it('accepts an https public URL', () => {
    const url = validateEngineUrl('https://engine.example.com');
    expect(url.hostname).toBe('engine.example.com');
  });

  it('accepts an http public URL', () => {
    const url = validateEngineUrl('http://engine.example.com:8080');
    expect(url.port).toBe('8080');
  });

  it('rejects unparseable input', () => {
    expect(() => validateEngineUrl('not a url')).toThrow(UrlValidationError);
  });

  it('rejects file: scheme', () => {
    expect(() => validateEngineUrl('file:///etc/passwd')).toThrow(
      /must use http: or https:/,
    );
  });

  it('rejects javascript: scheme', () => {
    expect(() => validateEngineUrl('javascript:alert(1)')).toThrow(
      UrlValidationError,
    );
  });

  it('rejects gopher: scheme', () => {
    expect(() => validateEngineUrl('gopher://example.com')).toThrow(
      UrlValidationError,
    );
  });

  it('rejects localhost without allowPrivate', () => {
    expect(() => validateEngineUrl('http://localhost:8080')).toThrow(
      /loopback host/,
    );
  });

  it('rejects 127.0.0.1', () => {
    expect(() => validateEngineUrl('http://127.0.0.1:8080')).toThrow(
      UrlValidationError,
    );
  });

  it('rejects RFC-1918 10.x', () => {
    expect(() => validateEngineUrl('http://10.32.161.126:8080')).toThrow(
      /RFC-1918/,
    );
  });

  it('rejects RFC-1918 172.16-31', () => {
    expect(() => validateEngineUrl('http://172.20.0.1')).toThrow(UrlValidationError);
    expect(() => validateEngineUrl('http://172.16.0.1')).toThrow(UrlValidationError);
    expect(() => validateEngineUrl('http://172.31.255.255')).toThrow(UrlValidationError);
  });

  it('accepts 172.15 / 172.32 (outside RFC-1918)', () => {
    expect(() => validateEngineUrl('http://172.15.0.1')).not.toThrow();
    expect(() => validateEngineUrl('http://172.32.0.1')).not.toThrow();
  });

  it('rejects RFC-1918 192.168.x', () => {
    expect(() => validateEngineUrl('http://192.168.1.1')).toThrow(
      UrlValidationError,
    );
  });

  it('rejects link-local 169.254.x', () => {
    expect(() => validateEngineUrl('http://169.254.169.254')).toThrow(
      UrlValidationError,
    );
  });

  it('rejects 0.0.0.0/8', () => {
    expect(() => validateEngineUrl('http://0.0.0.0')).toThrow(UrlValidationError);
  });

  it('rejects IPv6 loopback ::1', () => {
    expect(() => validateEngineUrl('http://[::1]:8080')).toThrow(
      /IPv6 loopback/,
    );
  });

  it('rejects IPv6 fe80:: link-local', () => {
    expect(() => validateEngineUrl('http://[fe80::1]')).toThrow(UrlValidationError);
  });

  it('rejects IPv6 fc00::/7 unique-local', () => {
    expect(() => validateEngineUrl('http://[fc00::1]')).toThrow(UrlValidationError);
    expect(() => validateEngineUrl('http://[fd12::1]')).toThrow(UrlValidationError);
  });

  it('allows private URLs when allowPrivate=true', () => {
    expect(() =>
      validateEngineUrl('http://localhost:8080', { allowPrivate: true }),
    ).not.toThrow();
    expect(() =>
      validateEngineUrl('http://10.32.161.126:8080', { allowPrivate: true }),
    ).not.toThrow();
    expect(() =>
      validateEngineUrl('http://[::1]:8080', { allowPrivate: true }),
    ).not.toThrow();
  });

  it('rejects mixed-case literal "Localhost"', () => {
    expect(() => validateEngineUrl('http://Localhost:8080')).toThrow(
      UrlValidationError,
    );
  });
});

describe('stripTrailingSlashes', () => {
  it('returns the string unchanged when no trailing slash', () => {
    expect(stripTrailingSlashes('http://x.com')).toBe('http://x.com');
  });

  it('strips a single trailing slash', () => {
    expect(stripTrailingSlashes('http://x.com/')).toBe('http://x.com');
  });

  it('strips multiple trailing slashes', () => {
    expect(stripTrailingSlashes('http://x.com////')).toBe('http://x.com');
  });

  it('handles empty string', () => {
    expect(stripTrailingSlashes('')).toBe('');
  });

  it('handles all-slashes string', () => {
    expect(stripTrailingSlashes('///')).toBe('');
  });
});
