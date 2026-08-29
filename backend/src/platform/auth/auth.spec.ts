import { ExecutionContext } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import { sign as jwtSign } from 'jsonwebtoken';

import type { AuthRuntimeConfig } from './application/ports/auth-runtime-config.port';
import { JwtPayloadVerifierService } from './application/services/jwt-payload-verifier.service';
import { HttpJwtGuard } from './infrastructure/presentation/http/http-jwt.guard';
import { WsJwtGuard } from './infrastructure/presentation/ws/ws-jwt.guard';

type HttpRequestLike = {
  headers: Record<string, string>;
  user?: { id?: number; username?: string };
};

type WsClientLike = {
  handshakeHeaders: Record<string, string>;
  handshake: {
    headers: Record<string, string>;
    auth: Record<string, string>;
  };
  req: {
    headers: Record<string, string>;
  };
  url: string;
  user?: { id?: number; username?: string };
};

function createHttpContext(request: HttpRequestLike): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function createWsContext(client: WsClientLike): ExecutionContext {
  return {
    switchToWs: () => ({
      getClient: () => client,
    }),
  } as unknown as ExecutionContext;
}

describe('Auth guards', () => {
  const secret = 'unit-test-secret-unit-test-secret-unit-test-secret';
  const issuer = 'le-monde-de-lila';
  const config: AuthRuntimeConfig = {
    jwtAlgorithm: null,
    jwtSecret: secret,
    jwtPrivateKeyPem: null,
    jwtPrivateKeyPath: null,
    jwtPublicKeyPem: null,
    jwtPublicKeyPath: null,
    jwtIssuer: issuer,
    jwtAudience: null,
    jwtClockToleranceSeconds: 10,
  };

  it('HttpJwtGuard attaches payload to request', () => {
    const guard = new HttpJwtGuard(new JwtPayloadVerifierService(config));
    const token = jwtSign({ username: 'lila' }, secret, {
      algorithm: 'HS256',
      issuer,
      subject: '1',
      expiresIn: '1h',
    });
    const request: HttpRequestLike = {
      headers: { authorization: `Bearer ${token}` },
    };
    const context = createHttpContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toMatchObject({ username: 'lila' });
  });

  it('WsJwtGuard accepts token via query string', () => {
    const guard = new WsJwtGuard(new JwtPayloadVerifierService(config));
    const token = jwtSign({ id: 42, username: 'x' }, secret, {
      algorithm: 'HS256',
      issuer,
      subject: '42',
      expiresIn: '1h',
    });
    const client: WsClientLike = {
      handshakeHeaders: {},
      handshake: { headers: {}, auth: {} },
      req: { headers: {} },
      url: `ws://localhost?token=${token}`,
    };
    const context = createWsContext(client);

    expect(guard.canActivate(context)).toBe(true);
    expect(client.user).toMatchObject({ id: 42 });
  });

  it('HttpJwtGuard supports RS256 with public key', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

    const rsaConfig: AuthRuntimeConfig = {
      jwtAlgorithm: null,
      jwtSecret: null,
      jwtPrivateKeyPem: String(privateKeyPem),
      jwtPrivateKeyPath: null,
      jwtPublicKeyPem: String(publicKeyPem),
      jwtPublicKeyPath: null,
      jwtIssuer: issuer,
      jwtAudience: null,
      jwtClockToleranceSeconds: 10,
    };
    const guard = new HttpJwtGuard(new JwtPayloadVerifierService(rsaConfig));

    const token = jwtSign({ username: 'lila' }, privateKeyPem, {
      algorithm: 'RS256',
      issuer,
      subject: '1',
      expiresIn: '1h',
    });

    const request: HttpRequestLike = {
      headers: { authorization: `Bearer ${token}` },
    };
    const context = createHttpContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toMatchObject({ username: 'lila' });
  });
});
