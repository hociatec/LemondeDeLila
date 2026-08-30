import type { ConfigService } from '@nestjs/config';
import type { WebSocket } from 'ws';
import type { SessionStateStore } from '../../../../session/public-api';
import { WsRouteRegistry } from '../../../../ws/public-api';
import type { ClientVersionPolicy } from '../../../application/ports/client-version-policy.port';
import { RealtimeApiHandlerService } from './realtime-api-handler.service';
import type { RealtimeClientSession } from './realtime-api.types';
import { RealtimeRequestReplayService } from './realtime-request-replay.service';
import { PerfMetricsService } from '../../../../observability/public-api';

describe('RealtimeApiHandlerService', () => {
  const setup = (overrides: Record<string, number> = {}) => {
    const registry = new WsRouteRegistry();
    const sessionStore = {
      save: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<SessionStateStore>;
    const updates = {
      getMinimumVersion: jest.fn().mockResolvedValue(null),
    } as ClientVersionPolicy;
    const config = {
      get: (key: string, fallback: number) => overrides[key] ?? fallback,
    } as ConfigService;
    const perf = new PerfMetricsService();
    const service = new RealtimeApiHandlerService(
      registry,
      sessionStore,
      updates,
      config,
      new RealtimeRequestReplayService(),
      perf,
    );
    const send = jest.fn();
    const close = jest.fn();
    const client = { readyState: 1, send, close } as unknown as WebSocket;
    const session: RealtimeClientSession = {
      socket: client,
      user: null,
      connectionId: 'connection-1',
      clientVersion: null,
      clientProduct: null,
    };
    return { service, registry, client, session, send, close, perf };
  };

  it('rejects unknown top-level properties instead of dispatching them', async () => {
    const { service, registry, client, session } = setup();
    const handler = jest.fn();
    registry.register('safe.action', handler);

    await service.handleIncoming(
      client,
      session,
      JSON.stringify({ type: 'safe.action', payload: {}, unexpected: true }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects oversized payloads before route dispatch', async () => {
    const { service, registry, client, session } = setup({
      WS_MAX_PAYLOAD_BYTES: 32,
    });
    const handler = jest.fn();
    registry.register('safe.action', handler);

    await service.handleIncoming(
      client,
      session,
      JSON.stringify({
        type: 'safe.action',
        payload: { text: 'x'.repeat(100) },
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it('rate limits one connection with a stable public error envelope', async () => {
    const { service, registry, client, session, send } = setup({
      WS_RATE_LIMIT_COUNT: 1,
      WS_RATE_LIMIT_WINDOW_MS: 60_000,
    });
    registry.register('safe.action', async () => ({
      type: 'safe.result',
      payload: { ok: true },
    }));
    const message = JSON.stringify({
      type: 'safe.action',
      payload: {},
    });

    await service.handleIncoming(client, session, message);
    await service.handleIncoming(client, session, message);

    expect(send).toHaveBeenLastCalledWith(
      JSON.stringify({
        type: 'error',
        context: 'safe.action',
        payload: { message: 'Trop de requêtes' },
      }),
    );
  });

  it('executes a requestId once and replays its response across reconnects', async () => {
    const { service, registry, client, session, send, perf } = setup();
    const handler = jest.fn().mockResolvedValue({
      type: 'sensitive.ok',
      payload: { committed: true },
    });
    registry.register('sensitive.command', handler);
    const message = JSON.stringify({
      type: 'sensitive.command',
      requestId: 'stable-command-id',
      payload: {},
    });
    session.user = { id: 42, username: 'lila', roles: [] };

    await Promise.all([
      service.handleIncoming(client, session, message),
      service.handleIncoming(
        client,
        { ...session, connectionId: 'reconnected' },
        message,
      ),
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(perf.snapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'ws.reconnect.replay', count: 1 }),
      ]),
    );
  });

  it('records handler failures without exposing their details as metric labels', async () => {
    const { service, registry, client, session, perf } = setup();
    registry.register('failing.command', async () => {
      throw new Error('secret database detail');
    });

    await service.handleIncoming(
      client,
      session,
      JSON.stringify({ type: 'failing.command', payload: {} }),
    );

    expect(perf.snapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'ws.handler.error', count: 1 }),
      ]),
    );
  });

  it('rejects reuse of one requestId for a different command', async () => {
    const { service, registry, client, session, send } = setup();
    registry.register('first.command', async () => ({
      type: 'first.ok',
      payload: {},
    }));
    registry.register('second.command', async () => ({
      type: 'second.ok',
      payload: {},
    }));
    session.user = { id: 7, username: 'user', roles: [] };

    await service.handleIncoming(
      client,
      session,
      JSON.stringify({ type: 'first.command', requestId: 'same' }),
    );
    await service.handleIncoming(
      client,
      session,
      JSON.stringify({ type: 'second.command', requestId: 'same' }),
    );

    expect(JSON.parse(send.mock.calls.at(-1)?.[0] as string)).toMatchObject({
      type: 'error',
      payload: { message: expect.stringContaining('déjà utilisé') },
    });
  });

  it('rejects an obsolete client before dispatch and closes with 4406', async () => {
    const { service, registry, client, session, close } = setup();
    const handler = jest.fn();
    registry.register('sensitive.command', handler);
    session.clientVersion = '1.0.0';
    (
      service as unknown as { updates: { getMinimumVersion: jest.Mock } }
    ).updates.getMinimumVersion = jest.fn().mockResolvedValue('2.0.0');

    await service.handleIncoming(
      client,
      session,
      JSON.stringify({
        type: 'sensitive.command',
        requestId: 'outdated-1',
      }),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(4406, 'update required');
  });
});
