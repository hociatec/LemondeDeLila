import {
  requireJwtSigningKey,
  requireJwtVerifyKey,
} from './jwt-config.service';
import type { AuthRuntimeConfig } from '../ports/auth-runtime-config.port';

const config: AuthRuntimeConfig = {
  jwtPrivateKeyPem: null,
  jwtPrivateKeyPath: null,
  jwtPublicKeyPem: null,
  jwtPublicKeyPath: null,
  jwtIssuer: 'test',
  jwtAudience: null,
  jwtClockToleranceSeconds: 10,
};

it('prefers explicit PEM and does not fall back to an arbitrary signing secret', () => {
  expect(
    requireJwtSigningKey({
      ...config,
      jwtPrivateKeyPem: 'configured-key',
      jwtPrivateKeyPath: 'missing',
    }),
  ).toBe('configured-key');
  expect(
    requireJwtVerifyKey({ ...config, jwtPublicKeyPem: 'public-key' }),
  ).toBe('public-key');
  expect(() => requireJwtSigningKey(config)).toThrow(
    'Configuration JWT manquante',
  );
});

it('does not expose the path or filesystem error when a key file is missing', () => {
  expect(() =>
    requireJwtVerifyKey({
      ...config,
      jwtPublicKeyPath: 'missing-private-location/key.pem',
    }),
  ).toThrow('Configuration JWT manquante');
});
