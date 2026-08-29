import { WebSocket } from 'ws';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import { NotificationWsInboxHandler } from './notification-ws-inbox.handler';
import { NotificationWsSessionService } from './notification-ws-session.service';

const socket = () =>
  ({ readyState: WebSocket.OPEN, send: jest.fn(), close: jest.fn() }) as any;

describe('notification WebSocket services', () => {
  it('keeps presence online until the last socket disconnects and reconnects', () => {
    const dispatch = { register: jest.fn(), unregister: jest.fn() };
    const counts = { getCounts: jest.fn() };
    const presence = { notifyFriendsPresence: jest.fn() };
    const service = new NotificationWsSessionService(
      dispatch as any,
      counts as any,
      presence as any,
    );
    const first = socket();
    const second = socket();
    const meta = {
      userId: 7,
      username: 'Alice',
      roles: [],
      socket: first,
      origin: null,
      product: null,
    };
    service.register(first, meta);
    service.register(second, { ...meta, socket: second });
    service.unregister(first);
    expect(presence.notifyFriendsPresence).toHaveBeenCalledTimes(1);
    service.unregister(second);
    expect(presence.notifyFriendsPresence).toHaveBeenLastCalledWith(
      7,
      'Alice',
      false,
    );
    service.register(first, meta);
    expect(presence.notifyFriendsPresence).toHaveBeenLastCalledWith(
      7,
      'Alice',
      true,
    );
  });

  it('pushes unread counts and degrades explicitly on storage failure', async () => {
    const counts = {
      getCounts: jest
        .fn()
        .mockResolvedValue({ unreadNotifications: 2, unreadMessages: 3 }),
    };
    const service = new NotificationWsSessionService(
      { register: jest.fn(), unregister: jest.fn() } as any,
      counts as any,
      { notifyFriendsPresence: jest.fn() } as any,
    );
    const client = socket();
    await service.sendConnected(client, 7);
    expect(JSON.parse(client.send.mock.calls[1][0])).toEqual({
      type: WS_EVENTS.notify.counts,
      payload: { unreadNotifications: 2, unreadMessages: 3 },
    });
    counts.getCounts.mockRejectedValueOnce(new Error('down'));
    await service.sendConnected(client, 7);
    expect(JSON.parse(client.send.mock.calls.at(-1)[0])).toEqual({
      type: WS_EVENTS.notify.counts,
      payload: { unreadNotifications: 0, unreadMessages: 0 },
    });
  });

  it('lists, marks and deletes only through the authenticated actor inbox', async () => {
    const contacts = {
      listInbox: jest.fn().mockResolvedValue([{ id: 'notification-1' }]),
      markRead: jest.fn().mockResolvedValue(undefined),
      deleteInboxItem: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new NotificationWsInboxHandler(
      contacts as any,
      { getCounts: jest.fn() } as any,
    );
    const client = socket();
    const meta = { userId: 7, username: 'Alice', roles: [] } as any;
    const send = jest.fn();
    await handler.handle(
      client,
      meta,
      WS_EVENTS.notify.inbox.markRead,
      { id: ' notification-1 ' },
      'request-1',
      send,
    );
    await handler.handle(
      client,
      meta,
      WS_EVENTS.notify.inbox.delete,
      { id: 'notification-1' },
      'request-2',
      send,
    );
    expect(contacts.markRead).toHaveBeenCalledWith(7, 'notification-1');
    expect(contacts.deleteInboxItem).toHaveBeenCalledWith(7, 'notification-1');
    expect(contacts.listInbox).toHaveBeenCalledWith(7, 200);
  });
});
