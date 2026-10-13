import { AdminContactQueryService } from './admin-contact-query.service';
import type { NotificationInboxRepository } from '../ports/notification-inbox.repository';
import { NotificationContactNotFoundError } from '../../domain/errors/notification-domain.errors';

describe('contact conversation history', () => {
  const row = (userId: number, message: string, seconds: number) => ({
    userId,
    message,
    createdAt: new Date(1000 * seconds),
    fromUserId: 3,
    fromUsername: 'Alice',
    toUserId: null,
    payload: {},
  });

  it('requests only the authenticated inbox and returns chronological messages', async () => {
    const listByContactId = jest
      .fn()
      .mockResolvedValue([
        row(7, 'Reply', 2),
        row(7, 'Question', 1),
        row(8, 'Other inbox', 0),
      ]);
    const query = new AdminContactQueryService({
      listByContactId,
    } as unknown as NotificationInboxRepository);
    const result = await query.getThread(7, 'contact-1');
    expect(listByContactId).toHaveBeenCalledWith(
      'admin_contact',
      'contact-1',
      7,
    );
    expect(result.messages.map((message) => message.message)).toEqual([
      'Question',
      'Reply',
    ]);
  });

  it('does not reveal a conversation belonging to another inbox', async () => {
    const listByContactId = jest.fn().mockResolvedValue([row(8, 'Private', 1)]);
    const query = new AdminContactQueryService({
      listByContactId,
    } as unknown as NotificationInboxRepository);
    await expect(query.getThread(7, 'other-contact')).rejects.toBeInstanceOf(
      NotificationContactNotFoundError,
    );
  });
});
