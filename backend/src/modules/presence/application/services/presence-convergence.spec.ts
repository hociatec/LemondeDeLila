import { WebSocket } from 'ws';
import { operationalSettings } from '../../../../platform/config/public-api';
import { PresenceService } from './presence.service';
import type {
  PresenceEvent,
  PresenceTransport,
} from '../ports/presence-transport.port';

it('converges after lost snapshots, duplicate delivery, reconnect and shutdown', async () => {
  jest.useFakeTimers();
  let now = 1000;
  let drop = false;
  const receivers = new Set<(event: PresenceEvent) => void>();
  const events: PresenceEvent[] = [];
  const services: PresenceService[] = [];
  function instance() {
    let receiver: ((event: PresenceEvent) => void) | undefined;
    const transport: PresenceTransport = {
      connect: async () => {},
      subscribe: async (handler) => {
        receiver = handler;
        receivers.add(handler);
      },
      publish: async (event) => {
        events.push(structuredClone(event));
        if (!drop)
          for (const handler of receivers) handler(structuredClone(event));
      },
      disconnect: async () => {
        if (receiver) receivers.delete(receiver);
      },
    };
    const service = new PresenceService(
      {
        handle: async () => {},
        isChatBannedNow: async () => false,
        getChatBanInfo: async () => null,
        sendHistory: async () => {},
      },
      { listActiveRoomsByUserIds: async () => [] },
      transport,
      { now: () => now },
    );
    services.push(service);
    return service;
  }
  function socket() {
    const result: WebSocket = Reflect.construct(WebSocket, [
      null,
      undefined,
      { autoPong: true },
    ]);
    jest.spyOn(result, 'send').mockImplementation(() => {});
    jest.spyOn(result, 'close').mockImplementation(() => {});
    return result;
  }
  async function publish(service: PresenceService) {
    service.broadcastPresence();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }
  try {
    const first = instance();
    const second = instance();
    const local = socket();
    first.register(local, { id: 1, username: 'One' });
    second.register(socket(), { id: 2, username: 'Two' });
    await publish(first);
    await publish(second);
    expect(first.listPlayers().map((p) => p.id)).toEqual([1, 2]);
    expect(second.listPlayers()).toEqual(first.listPlayers());
    const stale = events[0];

    drop = true;
    first.unregister(local);
    await publish(first);
    now += operationalSettings.presenceOriginsCacheTtlMs;
    expect(second.listPlayers()).toEqual([]);
    drop = false;
    await publish(second);
    await publish(first);
    for (const handler of receivers) handler(stale);
    expect(second.listPlayers().map((p) => p.id)).toEqual([2]);

    // A restarted process has a new origin and may start its sequence at one.
    const restarted = instance();
    restarted.register(socket(), { id: 1, username: 'Reconnected' });
    await publish(restarted);
    expect(second.listPlayers().map((p) => p.id)).toEqual([1, 2]);
    await restarted.onModuleDestroy();
    expect(second.listPlayers().map((p) => p.id)).toEqual([2]);
  } finally {
    for (const service of services) await service.onModuleDestroy();
    jest.useRealTimers();
  }
});
