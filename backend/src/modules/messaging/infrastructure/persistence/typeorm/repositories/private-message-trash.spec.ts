import type { Repository } from 'typeorm';
import { PrivateMessageTypeormRepository } from './private-message-typeorm.repository';
import type { PrivateMessageEntity } from '../entities/private-message.entity';

function setup() {
  const builder = Object.fromEntries(
    [
      'leftJoinAndSelect',
      'where',
      'andWhere',
      'setParameters',
      'orderBy',
      'addOrderBy',
      'addSelect',
      'limit',
      'update',
      'set',
    ].map((method) => [method, jest.fn().mockReturnThis()]),
  ) as Record<string, jest.Mock>;
  builder.getMany = jest.fn().mockResolvedValue([]);
  builder.getCount = jest.fn().mockResolvedValue(0);
  builder.execute = jest.fn().mockResolvedValue({ affected: 0 });
  const repository = {
    createQueryBuilder: jest.fn().mockReturnValue(builder),
    delete: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const inbox = new PrivateMessageTypeormRepository(
    repository as unknown as Repository<PrivateMessageEntity>,
  );
  return { builder, repository, inbox };
}

describe('private message trash persistence', () => {
  it('purges only a matching participant copy already in trash', async () => {
    const { inbox, builder, repository } = setup();
    builder.execute
      .mockResolvedValueOnce({ affected: 0 })
      .mockResolvedValueOnce({ affected: 1 });
    const at = new Date('2026-10-13T12:00:00Z');
    expect(await inbox.purgeForUser('message-1', 2, at)).toBe(true);
    expect(builder.where).toHaveBeenCalledWith(
      'message_id = :messageId AND recipient_id = :userId',
      { messageId: 'message-1', userId: 2 },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'deleted_by_recipient_at IS NOT NULL AND purged_by_recipient_at IS NULL',
    );
    expect(builder.set).toHaveBeenCalledWith({ purgedByRecipientAt: at });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('rejects purge if neither participant has a matching trashed copy', async () => {
    const { inbox } = setup();
    expect(await inbox.purgeForUser('message-1', 99, new Date())).toBe(false);
  });

  it('excludes permanent removals from inbox, sent, trash, conversation and unread counts', async () => {
    const { inbox, builder } = setup();
    await inbox.findInbox(2, 100);
    expect(builder.where.mock.calls.at(-1)[0]).toContain(
      'm.purged_by_recipient_at IS NULL',
    );
    await inbox.findOutbox(1, 100);
    expect(builder.where.mock.calls.at(-1)[0]).toContain(
      'm.purged_by_sender_at IS NULL',
    );
    await inbox.findDeleted(2, 100);
    const trash = builder.where.mock.calls.at(-1)[0];
    expect(trash).toContain('m.purged_by_sender_at IS NULL');
    expect(trash).toContain('m.purged_by_recipient_at IS NULL');
    expect(builder.addSelect.mock.calls.at(-1)[0]).toContain(
      'm.sender_id = :userId',
    );
    await inbox.findConversation(1, 2, 100);
    const conversation = builder.where.mock.calls.at(-1)[0];
    expect(conversation).toContain('m.purged_by_sender_at IS NULL');
    expect(conversation).toContain('m.purged_by_recipient_at IS NULL');
    await inbox.countUnreadForRecipient(2);
    expect(builder.andWhere).toHaveBeenCalledWith(
      'm.deleted_by_recipient_at IS NULL AND m.purged_by_recipient_at IS NULL',
    );
  });

  it('never writes purge markers back from a stale save', async () => {
    const { inbox, repository } = setup();
    const row = {
      id: 1,
      messageId: 'message-1',
      sender: { id: 1, username: 'Alice' },
      recipient: { id: 2, username: 'Bob' },
      message: 'Hello',
      subject: null,
      createdAt: new Date(),
      deletedBySenderAt: null,
      deletedByRecipientAt: null,
      readByRecipientAt: null,
      purgedBySenderAt: null,
      purgedByRecipientAt: null,
    };
    repository.findOne.mockResolvedValue({
      ...row,
      purgedByRecipientAt: new Date(),
    });
    const saved = await inbox.save(row);
    expect(repository.save.mock.calls[0][0]).not.toHaveProperty(
      'purgedByRecipientAt',
    );
    expect(saved.purgedByRecipientAt).toBeInstanceOf(Date);
  });
});
