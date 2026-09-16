import { MessagingWsHandler } from './messaging-ws.handler';
import { MessagePresenterService } from '../../../application/services/message-presenter.service';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';

describe('Messaging wire responses consumed by WX', () => {
  const record = {
    messageId: 'test-message',
    sender: { id: 1, username: 'Alice' },
    recipient: { id: 2, username: 'Bob' },
    message: 'Bonjour',
    subject: null,
    createdAt: new Date('2026-09-16T20:00:00.000Z'),
  };
  const session = { user: { id: 1 } } as never;
  const messaging = {
    lookupUser: jest.fn(async () => record.recipient),
    send: jest.fn(async () => record),
    inbox: jest.fn(async () => []),
    outbox: jest.fn(async () => [record]),
    deleted: jest.fn(async () => []),
  };
  const handler = new MessagingWsHandler(
    messaging as never,
    new MessagePresenterService(),
    new PayloadValidationService(),
    { notifyMessageSent: jest.fn(async () => undefined) } as never,
  );

  it('returns the distinct search and send event names and serializable message', async () => {
    expect(await handler.search(session, { query: 'Bob' })).toEqual({
      type: 'messaging.user',
      payload: { user: record.recipient },
    });
    const sent = await handler.send(session, {
      recipientId: 2,
      text: 'Bonjour',
    });
    expect(sent.type).toBe('messaging.message');
    expect(sent.payload.message).toMatchObject({
      id: 'test-message',
      text: 'Bonjour',
      direction: 'sent',
      boxType: 'outbox',
      createdAt: '2026-09-16T20:00:00.000Z',
    });
    expect(JSON.parse(JSON.stringify(sent))).toEqual(sent);
  });

  it.each(['inbox', 'outbox', 'deleted'])(
    'loads the %s box without altering messages',
    async (box) => {
      const response = await handler.messages(session, { box, limit: 100 });
      expect(response.type).toBe('messaging.messages');
      expect(response.payload.box).toBe(box);
      expect(response.payload.items).toHaveLength(box === 'outbox' ? 1 : 0);
    },
  );
});
