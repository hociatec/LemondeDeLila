import { sanitizeLogText, sanitizeLogValue } from './log-sanitizer';

describe('log sanitizer', () => {
  it('redacts nested credentials and private payloads without mutation', () => {
    const input = {
      userId: 7,
      token: 'token-value',
      nested: { refresh_token: 'refresh-value', payload: { card: 'secret' } },
    };

    expect(sanitizeLogValue(input)).toEqual({
      userId: 7,
      token: '[REDACTED]',
      nested: { refresh_token: '[REDACTED]', payload: '[REDACTED]' },
    });
    expect(input.token).toBe('token-value');
  });

  it('redacts bearer credentials and serialized secret fields', () => {
    expect(
      sanitizeLogText('authorization=Bearer abc.def password="hunter2"'),
    ).not.toContain('abc.def');
    expect(sanitizeLogText('{"token":"abc"}')).not.toContain('abc');
  });

  it('accepts framework error objects and structured trace metadata', () => {
    expect(() => sanitizeLogText(new Error('redis unavailable'))).not.toThrow();
    const sanitized = sanitizeLogText({
      token: 'secret',
      code: 'ECONNREFUSED',
    });
    expect(sanitized).not.toContain('secret');
    expect(sanitized).toContain('ECONNREFUSED');
  });
});
