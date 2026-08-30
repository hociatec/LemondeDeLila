import { WebSocket } from 'ws';
import type { PresenceClient } from '../contracts/presence-client.model';
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

  it('normalise et verrouille le contexte de table reçu', async () => {
    const socket = createSocket();
    const client = createClient(socket);
    const presenceChanged = jest.fn();
    const service = new PresenceClientMessageService(
      chat as unknown as PresenceChatService,
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
