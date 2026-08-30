import type { WebSocket } from 'ws';
import { PerfMetricsService } from '../../../../observability/public-api';
import {
  WsApiHubService,
  WsJwtAuthService,
  WsTicketAuthService,
} from '../../../../ws/public-api';
import { RealtimeApiConnectionService } from './realtime-api-connection.service';
import { RealtimeApiHandlerService } from './realtime-api-handler.service';

describe('RealtimeApiConnectionService', () => {
  const setup = () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const client = {
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, listener);
      }),
      close: jest.fn(),
    } as unknown as WebSocket;
    const auth = {
      extractClientVersion: jest.fn(() => '1.2.3'),
      extractClientProduct: jest.fn(() => 'desktop'),
      extractToken: jest.fn(() => 'token'),
      verify: jest.fn(() => ({ id: 7, username: 'lila', roles: ['user'] })),
    } as unknown as WsJwtAuthService;
    const wsTickets = {
      validateIfTokenPresentDetailed: jest.fn(() => ({
        ok: true,
        reason: 'ok',
        ticketPresent: true,
      })),
    } as unknown as WsTicketAuthService;
    const hub = {
      register: jest.fn(),
      unregister: jest.fn(),
    } as unknown as WsApiHubService;
    const handler = {
      handleIncoming: jest.fn().mockResolvedValue(undefined),
      persistSession: jest.fn().mockResolvedValue(undefined),
      clearSession: jest.fn().mockResolvedValue(undefined),
    } as unknown as RealtimeApiHandlerService;
    const perf = new PerfMetricsService();
    const service = new RealtimeApiConnectionService(
      auth,
      wsTickets,
      hub,
      handler,
      perf,
    );
    return { service, client, listeners, auth, wsTickets, hub, handler, perf };
  };

  it('rejects authenticated connections without a valid ticket', async () => {
    const { service, client, wsTickets, hub, perf } = setup();
    (wsTickets.validateIfTokenPresentDetailed as jest.Mock).mockReturnValue({
      ok: false,
      reason: 'missing_ticket',
      ticketPresent: false,
    });

    await service.handleConnection(client, [], 'api');

    expect(client.close).toHaveBeenCalledWith(4403, 'ws ticket requis');
    expect(hub.register).not.toHaveBeenCalled();
    expect(perf.snapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'ws.connection.rejected', count: 1 }),
      ]),
    );
  });

  it('registers a game connection, persists it and requests its initial state', async () => {
    const { service, client, listeners, hub, handler, perf } = setup();
    await service.handleConnection(
      client,
      [{ url: '/ws/game?roomId=12&gameType=corridor' }],
      'game',
    );

    const session = (hub.register as jest.Mock).mock.calls[0][2];
    expect(session).toEqual({
      scope: 'game',
      roomId: 12,
      gameType: 'corridor',
      userId: 7,
    });
    expect(handler.persistSession).toHaveBeenCalledWith(
      expect.objectContaining({
        clientVersion: '1.2.3',
        clientProduct: 'desktop',
        roomId: 12,
        gameType: 'corridor',
      }),
    );
    expect(handler.handleIncoming).toHaveBeenCalledWith(
      client,
      expect.any(Object),
      JSON.stringify({
        type: 'game.join',
        payload: { roomId: 12, gameType: 'corridor' },
      }),
    );

    listeners.get('message')?.('payload');
    listeners.get('error')?.(new Error('socket'));
    expect(handler.handleIncoming).toHaveBeenCalledWith(
      client,
      expect.any(Object),
      'payload',
    );
    expect(client.close).toHaveBeenCalled();
    expect(perf.snapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'ws.connection.opened', count: 1 }),
        expect.objectContaining({ event: 'ws.connection.error', count: 1 }),
      ]),
    );
  });

  it('clears registered sessions on disconnect and ignores unknown clients', async () => {
    const { service, client, hub, handler, perf } = setup();
    await service.handleConnection(client, [], 'api');
    const connectionId = (hub.register as jest.Mock).mock.calls[0][0];

    service.handleDisconnect(client);
    service.handleDisconnect(client);

    expect(handler.clearSession).toHaveBeenCalledWith(connectionId);
    expect(hub.unregister).toHaveBeenCalledWith(connectionId);
    expect(perf.snapshot().events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'ws.connection.closed', count: 1 }),
      ]),
    );
  });

  it('keeps unauthenticated sessions when token verification fails', async () => {
    const { service, client, auth, handler } = setup();
    (auth.verify as jest.Mock).mockImplementation(() => {
      throw new Error('expired');
    });

    await service.handleConnection(client, [], 'api');

    expect(handler.persistSession).toHaveBeenCalledWith(
      expect.objectContaining({ user: null }),
    );
  });
});
