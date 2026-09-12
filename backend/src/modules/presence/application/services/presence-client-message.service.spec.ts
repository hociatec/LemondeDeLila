import { WebSocket } from 'ws';
import type { PresenceClient } from '../models/presence-client.model';
import type { PresenceChatService } from './presence-chat.service';
import { PresenceClientMessageService } from './presence-client-message.service';

function createSocket(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: jest.fn(),
    close: jest.fn(),
  } as unknown as WebSocket;
}

function createClient(socket: WebSocket): PresenceClient {
  return {
    socket,
    user: { id: 7, username: 'Lila', roles: [] },
    context: 'home',
    contextLocked: false,
    roomHint: null,
    lastInteractionAt: 0,
  };
}

describe('PresenceClientMessageService', () => {
  const chat = {
    sendMessage: jest.fn(),
    editMessage: jest.fn(),
    deleteMessage: jest.fn(),
    buildChatHistory: jest.fn(),
    isChatBannedNow: jest.fn(),
    getChatBanInfo: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it.each([
    [2000, 1000],
    [-1, 1000],
    [0.5, 1000],
    [900, 900],
  ])('bounds activity time %s by the server clock', async (at, expected) => {
    const client = createClient(createSocket());
    const service = new PresenceClientMessageService(
      chat as unknown as PresenceChatService,
      { now: () => 1000 },
    );
    await service.handle(
      client,
      JSON.stringify({ type: 'presence-activity', at }),
      { broadcastChat: jest.fn(), presenceChanged: jest.fn() },
    );
    expect(client.lastInteractionAt).toBe(expected);
  });

  it('normalise et verrouille le contexte de table reçu', async () => {
    const socket = createSocket();
    const client = createClient(socket);
    const presenceChanged = jest.fn();
    const service = new PresenceClientMessageService(
      chat as unknown as PresenceChatService,
      { now: () => Date.now() },
    );

    await service.handle(
      client,
      JSON.stringify({
        type: 'presence-context',
        context: 'TABLE',
        roomId: '42',
        roomName: '  Les quatre vents  ',
      }),
      { broadcastChat: jest.fn(), presenceChanged },
    );

    expect(client.context).toBe('table');
    expect(client.contextLocked).toBe(true);
    expect(client.roomHint).toEqual({
      id: 42,
      name: 'Les quatre vents',
    });
    expect(presenceChanged).toHaveBeenCalledTimes(1);
  });

  it('routes an explicit presence snapshot request without changing context', async () => {
    const socket = createSocket();
    const client = createClient(socket);
    const presenceSync = jest.fn();
    const service = new PresenceClientMessageService(
      chat as unknown as PresenceChatService,
      { now: () => 1000 },
    );

    await service.handle(client, JSON.stringify({ type: 'presence-sync' }), {
      broadcastChat: jest.fn(),
      presenceChanged: jest.fn(),
      presenceSync,
    });

    expect(presenceSync).toHaveBeenCalledWith(socket);
    expect(client.contextLocked).toBe(false);
  });

  it('routes an explicit chat history resynchronization', async () => {
    const socket = createSocket();
    const client = createClient(socket);
    const chatSync = jest.fn().mockResolvedValue(undefined);
    const service = new PresenceClientMessageService(
      chat as unknown as PresenceChatService,
      { now: () => 1000 },
    );

    await service.handle(client, JSON.stringify({ type: 'chat-sync' }), {
      broadcastChat: jest.fn(),
      presenceChanged: jest.fn(),
      chatSync,
    });

    expect(chatSync).toHaveBeenCalledWith(socket);
  });

  it('diffuse un message chat accepté', async () => {
    const socket = createSocket();
    const client = createClient(socket);
    const broadcastChat = jest.fn();
    chat.sendMessage.mockResolvedValue({
      kind: 'message-posted',
      message: { id: 'message-1', text: 'Bonjour' },
    });
    const service = new PresenceClientMessageService(
      chat as unknown as PresenceChatService,
      { now: () => Date.now() },
    );

    await service.handle(
      client,
      JSON.stringify({ type: 'chat-send', text: 'Bonjour' }),
      { broadcastChat, presenceChanged: jest.fn() },
    );

    expect(chat.sendMessage).toHaveBeenCalledWith(client.user, 'Bonjour');
    expect(broadcastChat).toHaveBeenCalledWith({
      type: 'chat-message',
      payload: { id: 'message-1', text: 'Bonjour' },
    });
  });

  it('notifie puis ferme la socket lorsque le chat est interdit', async () => {
    const socket = createSocket();
    const client = createClient(socket);
    const payload = {
      message: 'Accès refusé',
      reason: 'modération',
      until: '2026-08-27T00:00:00.000Z',
    };
    chat.sendMessage.mockResolvedValue({ kind: 'denied', payload });
    const service = new PresenceClientMessageService(
      chat as unknown as PresenceChatService,
      { now: () => Date.now() },
    );

    await service.handle(
      client,
      Buffer.from(JSON.stringify({ type: 'chat-send', text: 'Bonjour' })),
      { broadcastChat: jest.fn(), presenceChanged: jest.fn() },
    );

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'error', payload }),
    );
    expect(socket.close).toHaveBeenCalledWith(4403, 'chat banned');
  });
});

it('rejects oversized UTF-8, nested injection and deep payloads before chat dispatch', async () => {
  const sendMessage = jest.fn().mockResolvedValue({ kind: 'noop' });
  const chat = { sendMessage } as unknown as PresenceChatService;
  const service = new PresenceClientMessageService(chat, {
    now: () => Date.now(),
  });
  const from = {
    user: { id: 42 },
    socket: {},
    lastInteractionAt: 0,
  } as PresenceClient;
  const callbacks = { broadcastChat: jest.fn(), presenceChanged: jest.fn() };
  let nested: unknown = null;
  for (let i = 0; i < 33; i++) nested = { child: nested };
  for (const raw of [
    '{"type":"chat-send","text":"hello","extra":{"__proto__":{}}}',
    JSON.stringify({ type: 'chat-send', text: 'hello', extra: true }),
    JSON.stringify({ type: 'unknown-command' }),
    JSON.stringify({ type: 'chat-send', text: 'é'.repeat(9000) }),
    JSON.stringify({ type: 'chat-send', extra: nested }),
  ])
    await service.handle(from, raw, callbacks);
  expect(sendMessage).not.toHaveBeenCalled();
  expect(callbacks.presenceChanged).not.toHaveBeenCalled();
  await service.handle(from, '{"type":"chat-send","text":"hello"}', callbacks);
  expect(sendMessage).toHaveBeenCalledWith(from.user, 'hello');
});
