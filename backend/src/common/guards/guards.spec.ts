import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
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
  const secret = 'unit-test-secret';
  const config = new ConfigService({ JWT_SECRET: secret });

  it('HttpJwtGuard attaches payload to request', () => {
    const guard = new HttpJwtGuard(config);
    const token = jwt.sign({ username: 'lila' }, secret);
    const request: any = {
      headers: { authorization: `Bearer ${token}` },
    };
    const context = createHttpContext(request);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toMatchObject({ username: 'lila' });
  });

  it('WsJwtGuard accepts token via query string', () => {
    const guard = new WsJwtGuard(config);
    const token = jwt.sign({ id: 42 }, secret);
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
});
