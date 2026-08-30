import { environmentValidationSchema } from './environment-validation';
import fs from 'node:fs';
import path from 'node:path';

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

  it('validates the dedicated notification and presence Redis URLs', () => {
    const accepted = environmentValidationSchema.validate({
      ...validBase,
      NOTIFICATION_REDIS_URL: 'redis://127.0.0.1:6379/2',
      PRESENCE_REDIS_URL: 'redis://127.0.0.1:6379/3',
    });
    const rejected = environmentValidationSchema.validate({
      ...validBase,
      NOTIFICATION_REDIS_URL: 'not-a-url',
    });

    expect(accepted.error).toBeUndefined();
    expect(rejected.error?.message).toContain('NOTIFICATION_REDIS_URL');
  });

  it('accepts systemd boolean forms for forced client updates', () => {
    const enabled = environmentValidationSchema.validate({
      ...validBase,
      CLIENT_FORCE_LATEST: '1',
    });
    const disabled = environmentValidationSchema.validate({
      ...validBase,
      CLIENT_FORCE_LATEST: '0',
    });

    expect(enabled.error).toBeUndefined();
    expect(enabled.value.CLIENT_FORCE_LATEST).toBe(true);
    expect(disabled.error).toBeUndefined();
    expect(disabled.value.CLIENT_FORCE_LATEST).toBe(false);
  });

  it('keeps every supported variable documented in .env.example', () => {
    const example = fs.readFileSync(
      path.resolve(__dirname, '../../../.env.example'),
      'utf8',
    );
    const documented = new Set(
      [...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map(
        (match) => match[1],
      ),
    );
    const supported = new Set(
      Object.keys(environmentValidationSchema.describe().keys ?? {}),
    );

    expect([...documented].sort()).toEqual([...supported].sort());
  });
});
