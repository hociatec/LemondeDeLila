import { type ExecutionContext } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import { sign as jwtSign } from 'jsonwebtoken';

import type { AuthRuntimeConfig } from './application/ports/auth-runtime-config.port';
import { JwtPayloadVerifierService } from './application/services/jwt-payload-verifier.service';
import { HttpJwtGuard } from './infrastructure/presentation/http/http-jwt.guard';

type HttpRequestLike = {
  headers: Record<string, string>;
  user?: { id?: number; username?: string };
};

function createHttpContext(request: HttpRequestLike): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('Auth guards', () => {
  const issuer = 'le-monde-de-lila';
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const publicKeyPem = String(
    publicKey.export({ type: 'spki', format: 'pem' }),
  );
  const privateKeyPem = String(
    privateKey.export({ type: 'pkcs8', format: 'pem' }),
  );
  const config: AuthRuntimeConfig = {
    jwtPrivateKeyPem: privateKeyPem,
    jwtPrivateKeyPath: null,
    jwtPublicKeyPem: publicKeyPem,
    jwtPublicKeyPath: null,
    jwtIssuer: issuer,
    jwtAudience: null,
    jwtClockToleranceSeconds: 10,
  };

  it('attaches a verified RS256 payload to the HTTP request', () => {
    const guard = new HttpJwtGuard(new JwtPayloadVerifierService(config));
    const token = jwtSign({ username: 'lila' }, privateKeyPem, {
      algorithm: 'RS256',
      issuer,
      subject: '1',
      expiresIn: '1h',
    });
    const request: HttpRequestLike = {
      headers: { authorization: `Bearer ${token}` },
    };

    expect(guard.canActivate(createHttpContext(request))).toBe(true);
    expect(request.user).toMatchObject({ username: 'lila' });
  });
});
