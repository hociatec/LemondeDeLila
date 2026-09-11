import { ChatMessagePresenterService } from './chat-message-presenter.service';
import type { ChatMessageRecord } from '../read-models/chat-message.record';

it('rejects a corrupted chat timestamp instead of changing message chronology', () => {
  const message = {
    messageId: 'message-1',
    message: 'hello',
    createdAt: new Date(NaN),
  } as ChatMessageRecord;
  const presenter = new ChatMessagePresenterService();
  expect(() => presenter.normalize(message)).toThrow(RangeError);
  expect(
    presenter.normalize({
      ...message,
      createdAt: new Date('2026-09-08T10:00:00Z'),
    }).createdAt,
  ).toBe('2026-09-08T10:00:00.000Z');
});
