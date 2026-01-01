import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'crypto';
import { HttpJwtGuard } from './http-jwt.guard';
import { WsJwtGuard } from './ws-jwt.guard';

function createHttpContext(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function createWsContext(client: any): ExecutionContext {
  return {
    switchToWs: () => ({
      getClient: () => client,
    }),
  } as unknown as ExecutionContext;
}

describe('Auth guards', () => {
  const secret = 'unit-test-secret-unit-test-secret-unit-test-secret';
  const issuer = 'le-monde-de-lila';
  const config = new ConfigService({ JWT_SECRET: secret, JWT_ISSUER: issuer });

  it('HttpJwtGuard attaches payload to request', () => {
    const guard = new HttpJwtGuard(config);
    const token = jwt.sign(
      { username: 'lila' },
      secret,
      { algorithm: 'HS256', issuer, subject: '1', expiresIn: '1h' },
    );
    const request: any = {
      headers: { authorization: `Bearer ${token}` },
    };
    const context = createHttpContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toMatchObject({ username: 'lila' });
  });

  it('WsJwtGuard accepts token via query string', () => {
    const guard = new WsJwtGuard(config);
    const token = jwt.sign(
      { id: 42, username: 'x' },
      secret,
      { algorithm: 'HS256', issuer, subject: '42', expiresIn: '1h' },
    );
    const client: any = {
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

    const rsaConfig = new ConfigService({
      JWT_PUBLIC_KEY_PEM: publicKeyPem,
      JWT_PRIVATE_KEY_PEM: privateKeyPem,
      JWT_ISSUER: issuer,
    });
    const guard = new HttpJwtGuard(rsaConfig);

    const token = jwt.sign({ username: 'lila' }, privateKeyPem, {
      algorithm: 'RS256',
      issuer,
      subject: '1',
      expiresIn: '1h',
    });

    const request: any = { headers: { authorization: `Bearer ${token}` } };
    const context = createHttpContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toMatchObject({ username: 'lila' });
  });
});
