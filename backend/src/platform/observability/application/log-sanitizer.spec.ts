import { sanitizeLogText, sanitizeLogValue } from './log-sanitizer';

describe('log sanitizer', () => {
  it('sanitizes serialized structured messages, private fields and connection URLs', () => {
    const logged = sanitizeLogText(
      JSON.stringify({
        event: 'failure',
        payload: { privateMessage: 'private text' },
        nested: {
          'set-cookie': 'session=secret-cookie',
          api_key: 'key-value',
          email: 'person@example.invalid',
        },
        connection: 'mysql://user:db-password@localhost/database',
      }),
    );
    expect(JSON.parse(logged)).toEqual({
      event: 'failure',
      payload: '[REDACTED]',
      nested: {
        'set-cookie': '[REDACTED]',
        api_key: '[REDACTED]',
        email: '[REDACTED]',
      },
      connection: 'mysql://[REDACTED]@localhost/database',
    });
    for (const secret of [
      'private text',
      'secret-cookie',
      'key-value',
      'person@',
      'db-password',
    ])
      expect(logged).not.toContain(secret);
  });

  it('bounds deeply nested log values and accepts cycles', () => {
    const value: Record<string, unknown> = {};
    let child = value;
    for (let i = 0; i < 100; i++) child = child.next = {};
    expect(JSON.stringify(sanitizeLogValue(value))).toContain('[DEPTH_LIMIT]');
    value.self = value;
    expect(JSON.stringify(sanitizeLogValue(value))).toContain('[CIRCULAR]');
  });
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

  it('redacts email addresses and phone numbers in free-text messages', () => {
    const sanitized = sanitizeLogText(
      'contact alice@example.test or +33 6 12 34 56 78 for support',
    );
    expect(sanitized).toBe('contact [REDACTED] or [REDACTED] for support');
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
