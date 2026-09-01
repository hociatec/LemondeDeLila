import { UnauthorizedException } from '@nestjs/common';
import { generateKeyPairSync } from 'crypto';
import { sign } from 'jsonwebtoken';
import type { WsRuntimeConfig } from '../ports/ws-runtime-config.port';
import { WsJwtAuthService } from './ws-jwt-auth.service';
import { WsTicketAuthService } from './ws-ticket-auth.service';
import { WsTicketService } from './ws-ticket.service';

const secret = 'unit-test-secret-with-at-least-32-characters';
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const publicKeyPem = String(publicKey.export({ type: 'spki', format: 'pem' }));
const privateKeyPem = String(
  privateKey.export({ type: 'pkcs8', format: 'pem' }),
);

const runtimeConfig = (
  overrides: Partial<WsRuntimeConfig> = {},
): WsRuntimeConfig => ({
  nodeEnv: 'test',
  wsTicketSecret: secret,
  wsTicketTtlSeconds: 60,
  jwtIssuer: 'le-monde-de-lila',
  jwtAudience: null,
  jwtClockToleranceSeconds: 10,
  jwtPrivateKeyPem: privateKeyPem,
  jwtPrivateKeyPath: null,
  jwtPublicKeyPem: publicKeyPem,
  jwtPublicKeyPath: null,
  maxBufferedBytes: 1_048_576,
  ...overrides,
});

describe('WsJwtAuthService', () => {
  const service = new WsJwtAuthService(runtimeConfig());

  it('extracts authentication and client metadata from headers', () => {
    const client = {
      handshakeHeaders: {
        authorization: 'Bearer header-token',
        'x-lila-client-version': ' 1.2.3 ',
        'x-lila-client-product': ' Desktop ',
      },
    };

    expect(service.extractToken(client, [])).toBe('header-token');
    expect(service.extractClientVersion(client, [])).toBe('1.2.3');
    expect(service.extractClientProduct(client, [])).toBe('desktop');
  });

  it('rejects URL metadata and accepts canonical request headers', () => {
    const client = {
      url: '/ws?token=query-token&version=2.0&clientProduct=WX',
    };
    expect(service.extractToken(client, [])).toBeNull();
    expect(service.extractClientVersion(client, [])).toBeNull();
    expect(service.extractClientProduct(client, [])).toBeNull();
    expect(service.extractToken({ url: 'http://[' }, [])).toBeNull();
    expect(service.extractClientVersion({ url: 'http://[' }, [])).toBeNull();
    expect(service.extractClientProduct({ url: 'http://[' }, [])).toBeNull();
    expect(
      service.extractToken({}, [
        {
          url: '/ws?v=3.0&clientProduct=desktop',
          headers: { authorization: ['Bearer request-token'] },
        },
      ]),
    ).toBe('request-token');
    expect(
      service.extractToken(
        { handshakeHeaders: { authorization: 'Basic x' } },
        [],
      ),
    ).toBeNull();
  });

  it('verifies complete JWT payloads and safely handles invalid tokens', () => {
    const token = sign(
      {
        id: 7,
        username: ' lila ',
        email: 'lila@example.test',
        roles: ['user'],
      },
      privateKeyPem,
      {
        algorithm: 'RS256',
        issuer: 'le-monde-de-lila',
        subject: '7',
        expiresIn: '5m',
      },
    );
    expect(service.verify(token)).toEqual(
      expect.objectContaining({
        id: 7,
        sub: '7',
        username: 'lila',
        email: 'lila@example.test',
        roles: ['user'],
      }),
    );
    expect(service.tryVerify('invalid')).toBeNull();
    expect(service.tryVerify(null)).toBeNull();
    expect(() => service.verify('invalid')).toThrow(UnauthorizedException);
  });

  it('rejects incomplete payloads', () => {
    const incomplete = sign({ username: 'x' }, privateKeyPem, {
      algorithm: 'RS256',
      issuer: 'le-monde-de-lila',
      subject: '7',
      expiresIn: '5m',
    });
    expect(() => service.verify(incomplete)).toThrow(UnauthorizedException);

    const minimal = sign(
      { id: 7, roles: ['user', 2, 'admin'] },
      privateKeyPem,
      {
        algorithm: 'RS256',
        issuer: 'le-monde-de-lila',
        subject: 'fallback-name',
        expiresIn: '5m',
      },
    );
    expect(() => service.verify(minimal)).toThrow(UnauthorizedException);
  });
});

describe('WsTicketService and WsTicketAuthService', () => {
  it('issues scoped short-lived tickets and validates their payload', () => {
    const tickets = new WsTicketService(
      runtimeConfig({ wsTicketTtlSeconds: 999 }),
    );
    const issued = tickets.issue(42, 'game');
    expect(issued.expiresInSeconds).toBe(300);
    expect(tickets.verify(issued.ticket, 'game')).toEqual(
      expect.objectContaining({ sub: '42', scope: 'game' }),
    );
    expect(() => tickets.verify(issued.ticket, 'api')).toThrow(
      UnauthorizedException,
    );
    expect(() => tickets.issue(0, 'api')).toThrow(UnauthorizedException);
  });

  it('uses one ephemeral secret outside production and rejects missing production config', () => {
    const development = new WsTicketService(
      runtimeConfig({
        nodeEnv: 'development',
        wsTicketSecret: null,
        wsTicketTtlSeconds: 1,
      }),
    );
    const issued = development.issue(1, 'api');
    expect(issued.expiresInSeconds).toBe(10);
    expect(development.verify(issued.ticket, 'api').sub).toBe('1');

    const production = new WsTicketService(
      runtimeConfig({ nodeEnv: 'production', wsTicketSecret: null }),
    );
    expect(() => production.issue(1, 'api')).toThrow(UnauthorizedException);
  });

  it('rejects tickets with invalid payload fields', () => {
    const tickets = new WsTicketService(runtimeConfig());
    const ticket = (payload: object) =>
      sign(payload, secret, {
        audience: 'lila-ws',
        issuer: 'lila-backend',
        expiresIn: '1m',
      });

    expect(() =>
      tickets.verify(ticket({ scope: 'api', jti: 'x' }), 'api'),
    ).toThrow(UnauthorizedException);
    expect(() =>
      tickets.verify(ticket({ sub: '-1', scope: 'api', jti: 'x' }), 'api'),
    ).toThrow(UnauthorizedException);
    expect(() =>
      tickets.verify(ticket({ sub: '1', scope: 'api', jti: ' ' }), 'api'),
    ).toThrow(UnauthorizedException);
  });

  it('extracts tickets from the canonical header with detailed outcomes', () => {
    const tickets = { verify: jest.fn() } as unknown as WsTicketService;
    const auth = new WsTicketAuthService(tickets);
    expect(auth.validateIfTokenPresentDetailed({}, [], 'api', false)).toEqual({
      ok: true,
      reason: 'not_required',
      ticketPresent: false,
    });
    expect(auth.validateIfTokenPresentDetailed({}, [], 'api', true)).toEqual({
      ok: false,
      reason: 'missing_ticket',
      ticketPresent: false,
    });
    expect(
      auth.validate(
        { handshakeHeaders: { 'x-lila-ws-ticket': 'abc' } },
        [],
        'api',
      ),
    ).toBe(true);
    expect(tickets.verify).toHaveBeenCalledWith('abc', 'api');

    expect(
      auth.validateIfTokenPresentDetailed(
        {},
        [{ headers: { 'x-lila-ws-ticket': 'request-ticket' } }],
        'room',
        true,
      ),
    ).toEqual({ ok: true, reason: 'ok', ticketPresent: true });
    expect(tickets.verify).toHaveBeenCalledWith('request-ticket', 'room');
    expect(auth.validateIfTokenPresent({}, [], 'api', false)).toBe(true);
    expect(auth.validateIfTokenPresent({}, [], 'api', true)).toBe(false);
    expect(auth.validate({}, [], 'api')).toBe(false);

    (tickets.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error('invalid');
    });
    expect(
      auth.validateIfTokenPresentDetailed(
        { handshakeHeaders: { 'x-lila-ws-ticket': ['bad'] } },
        [],
        'api',
        true,
      ),
    ).toEqual({ ok: false, reason: 'invalid_ticket', ticketPresent: true });

    (tickets.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error('invalid');
    });
    expect(
      auth.validate(
        { req: { headers: { 'x-lila-ws-ticket': 'invalid' } } as never },
        [],
        'api',
      ),
    ).toBe(false);
  });
});
