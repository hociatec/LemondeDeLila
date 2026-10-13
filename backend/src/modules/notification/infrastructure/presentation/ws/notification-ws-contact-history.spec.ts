import type { WebSocket } from 'ws';
import { NotificationWsInboxThreadHandler } from './notification-ws-inbox-thread.handler';
import type { AdminContactService } from '../../../application/services/admin-contact.service';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';

it('reads a selected contact using the authenticated identity and correlates the response', async () => {
  const result = {
    contactId: 'contact-1',
    messages: [{ message: 'Question' }],
  };
  const getThread = jest.fn().mockResolvedValue(result);
  const handler = new NotificationWsInboxThreadHandler({
    getThread,
  } as unknown as AdminContactService);
  const client = {} as WebSocket;
  const meta = {
    userId: 7,
    username: 'Admin',
    roles: ['ROLE_ADMIN'],
    socket: client,
    origin: null,
    product: null,
  };
  const send = jest.fn();
  await handler.handle(
    client,
    meta,
    WS_EVENTS.notify.inbox.threads,
    { contactId: ' contact-1 ', userId: 99 },
    'request-1',
    send,
  );
  expect(getThread).toHaveBeenCalledWith(7, ' contact-1 ');
  expect(send).toHaveBeenCalledWith(
    client,
    WS_EVENTS.notify.inbox.threads,
    result,
    'request-1',
  );
  getThread.mockRejectedValueOnce(new Error('Contact introuvable'));
  await handler.handle(
    client,
    meta,
    WS_EVENTS.notify.inbox.threads,
    { contactId: 'missing' },
    'request-2',
    send,
  );
  expect(send).toHaveBeenLastCalledWith(
    client,
    WS_EVENTS.notify.inbox.error,
    { message: 'Contact introuvable' },
    'request-2',
  );
});
