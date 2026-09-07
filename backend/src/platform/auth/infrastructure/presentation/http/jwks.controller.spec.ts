import { generateKeyPairSync } from 'crypto';

import type { AuthRuntimeConfig } from '../../../application/ports/auth-runtime-config.port';
import { JwksDocumentService } from '../../../application/services/jwks-document.service';
import { JwksController } from './jwks.controller';

type JwksResponse = {
  keys: Array<Record<string, unknown>>;
};

describe('JwksController', () => {
  it('returns a JWKS when RS256 is configured', () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

    const config: AuthRuntimeConfig = {
      jwtPrivateKeyPem: null,
      jwtPrivateKeyPath: null,
      jwtPublicKeyPem: String(publicKeyPem),
      jwtPublicKeyPath: null,
      jwtIssuer: 'le-monde-de-lila',
      jwtAudience: null,
      jwtClockToleranceSeconds: 10,
    };

    const controller = new JwksController(new JwksDocumentService(config));
    const res = controller.jwks() as JwksResponse;

    expect(res?.keys?.length).toBe(1);
    expect(res.keys[0]).toMatchObject({ kty: 'RSA', use: 'sig', alg: 'RS256' });
    expect(typeof res.keys[0].n).toBe('string');
    expect(typeof res.keys[0].e).toBe('string');
    expect(typeof res.keys[0].kid).toBe('string');
  });
});
