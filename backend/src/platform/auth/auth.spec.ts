import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { generateKeyPairSync, sign as cryptoSign } from 'crypto';
import { sign as jwtSign } from 'jsonwebtoken';

import type { AuthRuntimeConfig } from './application/ports/auth-runtime-config.port';
import { JwtPayloadVerifierService } from './application/services/jwt-payload-verifier.service';
import { HttpJwtGuard } from './infrastructure/presentation/http/http-jwt.guard';
import { credentialVersion } from './application/services/credential-version';

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

  it('attaches a verified RS256 payload with current account roles to the HTTP request', async () => {
    const guard = new HttpJwtGuard(new JwtPayloadVerifierService(config), {
      findById: async () => ({
        id: 1,
        username: 'lila',
        email: '',
        roles: ['ROLE_USER'],
        bannedUntil: null,
        password: 'stored-hash',
      }),
    });
    const token = jwtSign(
      {
        username: 'lila',
        roles: ['ROLE_ADMIN'],
        credentialVersion: credentialVersion('stored-hash'),
      },
      privateKeyPem,
      {
        algorithm: 'RS256',
        issuer,
        subject: '1',
        expiresIn: '1h',
      },
    );
    const request: HttpRequestLike = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(createHttpContext(request))).resolves.toBe(
      true,
    );
    expect(request.user).toMatchObject({
      id: 1,
      username: 'lila',
      roles: ['ROLE_USER'],
    });
  });

  it.each(['deleted', 'banned', 'password-changed', 'legacy'])(
    'rejects a still-signed token for a %s session',
    async (scenario) => {
      const account = {
        id: 1,
        username: 'lila',
        email: '',
        roles: ['ROLE_ADMIN'],
        bannedUntil:
          scenario === 'banned' ? new Date(Date.now() + 60000) : null,
        password: scenario === 'password-changed' ? 'new-hash' : 'stored-hash',
      };
      const guard = new HttpJwtGuard(new JwtPayloadVerifierService(config), {
        findById: async () => (scenario === 'deleted' ? null : account),
      });
      const token = jwtSign(
        {
          username: 'lila',
          roles: ['ROLE_ADMIN'],
          credentialVersion:
            scenario === 'legacy'
              ? undefined
              : credentialVersion('stored-hash'),
        },
        privateKeyPem,
        { algorithm: 'RS256', issuer, subject: '1', expiresIn: '1h' },
      );
      await expect(
        guard.canActivate(
          createHttpContext({ headers: { authorization: `Bearer ${token}` } }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it.each([
    ['01', 1],
    ['1e3', 1000],
    ['1.5', 1.5],
    ['-1', -1],
    ['0', 0],
    ['9007199254740993', 9007199254740992],
    ['7', 8],
    ['7', '7'],
    ['7', true],
  ])('rejects signed inconsistent identities %s / %s', (sub, id) => {
    const verifier = new JwtPayloadVerifierService(config);
    const token = jwtSign({ username: 'lila', id }, privateKeyPem, {
      algorithm: 'RS256',
      issuer,
      subject: String(sub),
      expiresIn: '1h',
    });
    expect(() => verifier.verifyHttpToken(token)).toThrow(
      UnauthorizedException,
    );
    expect(() => verifier.verifyWsToken(token)).toThrow(UnauthorizedException);
  });

  it.each(['exp', 'iat'])('rejects a signed nonfinite %s claim', (claim) => {
    const verifier = new JwtPayloadVerifierService(config);
    const claims = JSON.stringify({
      id: 7,
      sub: '7',
      username: 'lila',
      iss: issuer,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }).replace(new RegExp(`"${claim}":\\d+`), `"${claim}":1e999`);
    const unsigned = [JSON.stringify({ alg: 'RS256', typ: 'JWT' }), claims]
      .map((part) => Buffer.from(part).toString('base64url'))
      .join('.');
    const token = `${unsigned}.${cryptoSign('RSA-SHA256', Buffer.from(unsigned), privateKeyPem).toString('base64url')}`;
    expect(() => verifier.verifyHttpToken(token)).toThrow(
      UnauthorizedException,
    );
    expect(() => verifier.verifyWsToken(token)).toThrow(UnauthorizedException);
  });
});
