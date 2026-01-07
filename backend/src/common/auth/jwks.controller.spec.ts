import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import { JwksController } from './jwks.controller';

describe('JwksController', () => {
  it('returns a JWKS when RS256 is configured', () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });

    const config = new ConfigService({
      JWT_ALGORITHM: 'RS256',
      JWT_PUBLIC_KEY_PEM: publicKeyPem,
      JWT_ISSUER: 'le-monde-de-lila',
    });

    const controller = new JwksController(config);
    const res: any = controller.jwks();

    expect(res?.keys?.length).toBe(1);
    expect(res.keys[0]).toMatchObject({ kty: 'RSA', use: 'sig', alg: 'RS256' });
    expect(typeof res.keys[0].n).toBe('string');
    expect(typeof res.keys[0].e).toBe('string');
    expect(typeof res.keys[0].kid).toBe('string');
  });
});
