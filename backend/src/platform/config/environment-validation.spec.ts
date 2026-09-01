import { environmentValidationSchema } from './environment-validation';
import fs from 'node:fs';
import path from 'node:path';

const validBase = {
  NODE_ENV: 'test',
  JWT_ALGORITHM: 'RS256',
  JWT_PRIVATE_KEY_PEM: 'private-key',
  JWT_PUBLIC_KEY_PEM: 'public-key',
  WS_TICKET_SECRET: 'b'.repeat(32),
};

const validProduction = {
  ...validBase,
  NODE_ENV: 'production',
  JWT_ALGORITHM: 'RS256',
  JWT_PRIVATE_KEY_PEM: 'private-key',
  JWT_PUBLIC_KEY_PEM: 'public-key',
  JWT_AUDIENCE: 'lila-client',
  WS_TICKET_SECRET: 'w'.repeat(32),
  SESSION_STORE_REDIS_URL: 'redis://127.0.0.1:6379/1',
  GAME_ENGINE_STATE_REDIS_URL: 'redis://127.0.0.1:6379/0',
  RATE_LIMIT_REDIS_URL: 'redis://127.0.0.1:6379/4',
  DB_USER: 'lila',
  DB_PASSWORD: 'database-password',
  CLIENT_WX_UPDATES_UPLOAD_TOKEN: 'u'.repeat(32),
  CLIENT_WX_SIGNATURE_PUBLIC_KEY_PEM: 'update-public-key',
  CLIENT_WX_UPDATES_PUBLIC_URL: 'https://updates.example.test/client-wx',
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

  it('accepts a fully hardened production configuration', () => {
    expect(
      environmentValidationSchema.validate(validProduction).error,
    ).toBeUndefined();
  });

  it.each([
    [{ JWT_ALGORITHM: 'HS256' }, 'JWT_ALGORITHM'],
    [{ JWT_AUDIENCE: undefined }, 'JWT_AUDIENCE'],
    [{ DB_USER: 'root' }, 'DB_USER=root'],
    [{ DB_PASSWORD: '' }, 'DB_PASSWORD'],
    [{ RATE_LIMIT_REDIS_URL: undefined }, 'RATE_LIMIT_REDIS_URL'],
    [
      { CLIENT_WX_UPDATES_UPLOAD_TOKEN: undefined },
      'CLIENT_WX_UPDATES_UPLOAD_TOKEN',
    ],
    [
      { WS_TICKET_SECRET: 'change-me-with-at-least-32-characters' },
      'WS_TICKET_SECRET',
    ],
  ])('rejects an unsafe production setting', (override, expectedMessage) => {
    const result = environmentValidationSchema.validate({
      ...validProduction,
      ...override,
    });
    expect(result.error?.message).toContain(expectedMessage);
  });

  it('requires token and network allowlist when production maintenance is enabled', () => {
    const result = environmentValidationSchema.validate({
      ...validProduction,
      ADMIN_MAINTENANCE_ENABLED: true,
      ADMIN_MAINTENANCE_TOKEN: 'm'.repeat(32),
    });
    expect(result.error?.message).toContain('ADMIN_MAINTENANCE_ALLOWED_IPS');
  });

  it('requires both RSA key sides when RSA is configured', () => {
    const result = environmentValidationSchema.validate({
      ...validBase,
      JWT_ALGORITHM: 'RS256',
      JWT_PRIVATE_KEY_PEM: 'private',
      JWT_PUBLIC_KEY_PEM: undefined,
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
