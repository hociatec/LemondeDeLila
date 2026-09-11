import { inspect } from 'node:util';
import { validateEnvironment } from './validate-environment';

describe('startup environment diagnostics', () => {
  it('does not expose secrets in messages, stacks, causes or inspection', () => {
    const secret = 'private-secret-DO-NOT-LOG';
    try {
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: `https://user:${secret}@example.com broken`,
        JWT_PRIVATE_KEY_PEM: secret,
        WS_TICKET_SECRET: secret,
        ADMIN_MAINTENANCE_DEPLOY_UNIT: secret + ';run',
      });
      throw new Error('Expected validation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const diagnostic = inspect(error, { depth: 10, showHidden: true });
      expect(diagnostic).toContain('Configuration invalide');
      expect(diagnostic).toContain('DATABASE_URL');
      expect(diagnostic).not.toContain(secret);
      expect(diagnostic).not.toContain('example.com');
    }
  });

  it('preserves defaults and numeric coercion for ConfigService', () => {
    const result = validateEnvironment({
      NODE_ENV: 'test',
      JWT_ALGORITHM: 'RS256',
      JWT_PRIVATE_KEY_PEM: 'private-key',
      JWT_PUBLIC_KEY_PEM: 'public-key',
      WS_TICKET_SECRET: 'b'.repeat(32),
      PORT: '3001',
    });
    expect(result.PORT).toBe(3001);
    expect(result.ROOM_PAYLOAD_CACHE_TTL_SECONDS).toBe(15);
  });
});
