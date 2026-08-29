import { environmentValidationSchema } from './environment-validation';

const validBase = {
  NODE_ENV: 'test',
  JWT_SECRET: 'a'.repeat(32),
  WS_TICKET_SECRET: 'b'.repeat(32),
};

describe('environment validation', () => {
  it('applies safe numeric defaults', () => {
    const result = environmentValidationSchema.validate(validBase);
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual(
      expect.objectContaining({
        DB_PORT: 3306,
        BCRYPT_COST: 12,
        WS_MAX_PAYLOAD_BYTES: 65536,
      }),
    );
  });

  it('requires durable dependencies and signed HTTPS updates in production', () => {
    const result = environmentValidationSchema.validate({
      ...validBase,
      NODE_ENV: 'production',
    });
    expect(result.error?.message).toContain('SESSION_STORE_REDIS_URL');
  });

  it('requires both RSA key sides when RSA is configured', () => {
    const result = environmentValidationSchema.validate({
      ...validBase,
      JWT_SECRET: undefined,
      JWT_ALGORITHM: 'RS256',
      JWT_PRIVATE_KEY_PEM: 'private',
    });
    expect(result.error?.message).toContain('JWT_PUBLIC_KEY');
  });
});
