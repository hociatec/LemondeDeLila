import { MAX_PRESENCE_PLAYERS_PER_ORIGIN } from '../ports/presence-transport.port';
import type { WebSocket } from 'ws';
import type { PresenceClient } from '../models/presence-client.model';
import type { PresenceEvent } from '../ports/presence-transport.port';
import { PresenceTransport } from '../ports/presence-transport.port';
import type { PresenceRoomParticipantRepository } from '../ports/presence-room-participant.repository';
import { PresenceClientMessageService } from './presence-client-message.service';
import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let externalHandler: (event: PresenceEvent) => void;
  let messages: jest.Mocked<PresenceClientMessageService>;
  let participants: jest.Mocked<PresenceRoomParticipantRepository>;
  let transport: jest.Mocked<PresenceTransport>;
  let service: PresenceService;
  let now: number;

  beforeEach(() => {
    jest.useFakeTimers();
    now = 1_000_000;
    messages = {
      handle: jest.fn().mockResolvedValue(undefined),
      isChatBannedNow: jest.fn().mockResolvedValue(false),
      getChatBanInfo: jest.fn().mockResolvedValue(null),
      sendHistory: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PresenceClientMessageService>;
    participants = {
      listActiveRoomsByUserIds: jest.fn().mockResolvedValue([]),
    };
    transport = {
      connect: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockImplementation(async (handler) => {
        externalHandler = handler;
      }),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    service = new PresenceService(messages, participants, transport, {
      now: () => now,
    });
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('registers, locates and unregisters clients by socket and context', () => {
    const tavern = socket();
    const home = socket();

    service.register(tavern.value, { id: 1, username: 'Lila' }, 'tavern');
    service.register(home.value, { id: 2, username: 'Milo' });

    expect(service.findClient(tavern.value)).toMatchObject({
      user: { id: 1, username: 'Lila' },
      context: 'tavern',
      contextLocked: false,
      roomHint: null,
    });
    expect(service.isUserInTavern(1)).toBe(true);
    expect(service.isUserInTavern(2)).toBe(false);
    expect(service.isUserInTavern(0)).toBe(false);
    expect(service.isUserInTavern(Number.NaN)).toBe(false);

    service.unregister(tavern.value);
    expect(service.findClient(tavern.value)).toBeUndefined();
    service.unregister(home.value);
  });

  it('keeps admitted unique players within the transport snapshot capacity', () => {
    const connections = Array.from(
      { length: MAX_PRESENCE_PLAYERS_PER_ORIGIN },
      () => socket(),
    );
    for (const [index, connection] of connections.entries()) {
      expect(
        service.register(connection.value, {
          id: index + 1,
          username: 'Player',
        }),
      ).toBe(true);
    }
    const extra = socket();
    expect(
      service.register(extra.value, {
        id: MAX_PRESENCE_PLAYERS_PER_ORIGIN + 1,
        username: 'Extra',
      }),
    ).toBe(false);
    expect(service.findClient(extra.value)).toBeUndefined();
    expect(
      service.register(extra.value, { id: 1, username: 'Second socket' }),
    ).toBe(true);
    service.unregister(connections[1].value);
    expect(
      service.register(socket().value, {
        id: MAX_PRESENCE_PLAYERS_PER_ORIGIN + 1,
        username: 'New',
      }),
    ).toBe(true);
  });

  it('withdraws local presence and closes sockets before disconnecting its transport', async () => {
    const client = socket();
    service.register(client.value, { id: 1, username: 'Local' });
    await service.onModuleDestroy();
    expect(client.close).toHaveBeenCalledWith(1001, 'server shutdown');
    expect(service.findClient(client.value)).toBeUndefined();
    expect(transport.publish).toHaveBeenCalledWith(
      expect.objectContaining({ players: [], sequence: 1 }),
    );
    expect(service.register(socket().value, { id: 2, username: 'Late' })).toBe(
      false,
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('delegates chat operations and broadcasts chat only to chat clients', async () => {
    const chat = socket();
    const table = socket();
    service.register(chat.value, { id: 1, username: 'Chat' }, 'chat');
    service.register(table.value, { id: 2, username: 'Table' }, 'table');
    const from = service.findClient(chat.value) as PresenceClient;
    messages.handle.mockImplementation(async (_from, _raw, callbacks) => {
      callbacks.broadcastChat({ type: 'chat-message', text: 'bonjour' });
      callbacks.presenceChanged();
    });

    await service.handleClientPayload(from, { type: 'chat-send' });
    await settle();

    expect(chat.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'chat-message', text: 'bonjour' }),
    );
    expect(table.send).not.toHaveBeenCalledWith(
      JSON.stringify({ type: 'chat-message', text: 'bonjour' }),
    );
    expect(messages.handle).toHaveBeenCalledWith(
      from,
      { type: 'chat-send' },
      expect.any(Object),
    );
    expect(participants.listActiveRoomsByUserIds).toHaveBeenCalled();
  });

  it('delegates bans and history queries unchanged', async () => {
    const target = socket();
    messages.isChatBannedNow.mockResolvedValue(true);
    messages.getChatBanInfo.mockResolvedValue({
      until: new Date('2030-01-01T00:00:00Z'),
      reason: 'spam',
    });

    await expect(service.isChatBannedNow(8)).resolves.toBe(true);
    await expect(service.getChatBanInfo(8)).resolves.toEqual({
      until: new Date('2030-01-01T00:00:00Z'),
      reason: 'spam',
    });
    await expect(service.sendHistory(target.value)).resolves.toBeUndefined();
    expect(messages.sendHistory).toHaveBeenCalledWith(target.value);
  });

  it('enriches local presence with active rooms before publishing', async () => {
    const first = socket();
    const duplicate = socket();
    service.register(first.value, { id: 1, username: 'Lila' }, 'home');
    service.register(duplicate.value, { id: 1, username: 'Lila' }, 'chat');
    const client = service.findClient(duplicate.value) as PresenceClient;
    client.contextLocked = true;
    client.roomHint = { id: 4 };
    client.lastInteractionAt = Date.now();
    participants.listActiveRoomsByUserIds.mockResolvedValue([
      {
        userId: 1,
        room: {
          id: 9,
          name: 'Partie',
          status: 'started',
          startedAt: null,
        },
      },
      { userId: 999, room: null },
    ]);

    service.broadcastPresence();
    await settle();

    expect(transport.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.any(String),
        players: [
          expect.objectContaining({
            id: 1,
            activity: 'chat',
            currentRoom: { id: 4, name: 'Table #4' },
            roomStarted: true,
          }),
        ],
      }),
    );
    expect(JSON.parse(String(first.send.mock.calls.at(-1)?.[0]))).toMatchObject(
      {
        type: 'presence-update',
        players: [{ id: 1, availability: 'available', location: 'tchat' }],
      },
    );
  });

  it('continues broadcasting when room enrichment or transport publishing fails', async () => {
    const target = socket();
    service.register(target.value, { id: 1, username: 'Lila' });
    participants.listActiveRoomsByUserIds.mockRejectedValue(new Error('db'));
    transport.publish.mockRejectedValue(new Error('redis'));

    service.broadcastPresence();
    await settle();

    expect(target.send).toHaveBeenCalledWith(
      expect.stringContaining('presence-update'),
    );
    expect(transport.publish).toHaveBeenCalled();
  });

  it('versions each client stream and serves an explicit full resynchronization', async () => {
    const target = socket();
    service.register(target.value, { id: 1, username: 'Lila' });
    service.broadcastPresence();
    await settle();
    const first = JSON.parse(String(target.send.mock.calls.at(-1)?.[0]));
    messages.handle.mockImplementation(async (_from, _raw, callbacks) => {
      callbacks.presenceSync?.(target.value);
    });

    await service.handleClientPayload(
      service.findClient(target.value) as PresenceClient,
      JSON.stringify({ type: 'presence-sync' }),
    );
    const second = JSON.parse(String(target.send.mock.calls.at(-1)?.[0]));

    expect(first.realtime).toEqual({
      streamId: expect.any(String),
      sequence: 1,
      snapshot: true,
    });
    expect(second.realtime).toEqual({
      streamId: first.realtime.streamId,
      sequence: 2,
      snapshot: true,
    });
    expect(second.players).toEqual(first.players);
  });

  it('removes and closes a socket whose send fails', async () => {
    const broken = socket();
    broken.send.mockImplementation(() => {
      throw new Error('closed');
    });
    service.register(broken.value, { id: 1, username: 'Lila' });

    service.broadcastPresence();
    await settle();

    expect(service.findClient(broken.value)).toBeUndefined();
    expect(broken.close).toHaveBeenCalled();
  });

  it('merges external origins, ignores its own echo and expires stale origins', async () => {
    const target = socket();
    now = 1_000_000;
    service.register(target.value, { id: 1, username: 'Local' }, 'home');
    service.broadcastPresence();
    await settle();
    const localEvent = transport.publish.mock.calls[0][0];
    target.send.mockClear();

    externalHandler(localEvent);
    expect(target.send).not.toHaveBeenCalled();

    externalHandler({
      origin: 'remote',
      at: 999_900,
      players: [publicPlayer(2, 'Remote', 'table')],
    });
    externalHandler({
      origin: null,
      at: Number.NaN,
      players: undefined as never,
    });
    expect(service.listPlayers()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, username: 'Local' }),
        expect.objectContaining({ id: 2, username: 'Remote' }),
      ]),
    );

    now = 1_200_001;
    expect(service.listPlayers()).toEqual([]);
  });

  it('disconnects its transport during shutdown', async () => {
    await service.onModuleDestroy();
    expect(transport.disconnect).toHaveBeenCalled();
  });

  it('does not publish an older room enrichment after a newer presence snapshot', async () => {
    let finishFirst!: (value: []) => void;
    participants.listActiveRoomsByUserIds.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    );
    const client = socket();
    service.register(client.value, { id: 1, username: 'Local' });
    service.broadcastPresence();
    service.unregister(client.value);
    service.broadcastPresence();
    await settle();
    finishFirst([]);
    await settle();
    expect(transport.publish).toHaveBeenCalledTimes(1);
    expect(transport.publish).toHaveBeenCalledWith(
      expect.objectContaining({ players: [], sequence: 2 }),
    );
  });
});

function socket() {
  const send = jest.fn();
  const close = jest.fn();
  return {
    value: { send, close } as unknown as WebSocket,
    send,
    close,
  };
}

function publicPlayer(
  id: number,
  username: string,
  activity: 'home' | 'table',
) {
  return {
    id,
    username,
    activity,
    currentRoom: null,
    lastInteractionAt: 999_900,
    roomStarted: null,
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
