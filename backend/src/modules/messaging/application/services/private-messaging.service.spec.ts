import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrivateMessageRecord } from '../contracts/private-message.model';
import { MessageValidatorService } from './message-validator.service';
import { PrivateMessagingService } from './private-messaging.service';

describe('PrivateMessagingService', () => {
  const alice = { id: 1, username: 'Alice', avatar: null };
  const bob = { id: 2, username: 'Bob', avatar: null };
  const message = (): PrivateMessageRecord =>
    ({
      id: 1,
      messageId: 'message-1',
      sender: alice,
      recipient: bob,
      message: 'Bonjour',
      subject: null,
      createdAt: new Date(),
      readByRecipientAt: null,
      deletedBySenderAt: null,
      deletedByRecipientAt: null,
    }) as PrivateMessageRecord;
  const setup = () => {
    const messages = {
      create: jest.fn(async (input) => ({ ...message(), ...input })),
      save: jest.fn(async (value) => value),
      findByMessageId: jest.fn().mockResolvedValue(message()),
      findConversation: jest.fn().mockResolvedValue([]),
      findInbox: jest.fn().mockResolvedValue([]),
      findOutbox: jest.fn().mockResolvedValue([]),
      findDeleted: jest.fn().mockResolvedValue([]),
      remove: jest.fn(),
      countUnreadForRecipient: jest.fn(),
    };
    const users = {
      findById: jest.fn(async (id) =>
        id === 1 ? alice : id === 2 ? bob : null,
      ),
      findByUsername: jest.fn(),
    };
    return {
      service: new PrivateMessagingService(
        messages as any,
        users as any,
        new MessageValidatorService(),
      ),
      messages,
    };
  };

  it('prevents self messaging and clamps collection limits', async () => {
    const { service, messages } = setup();
    await expect(
      service.send(1, { recipientId: 1, text: 'test' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.inbox(1, 50_000);
    expect(messages.findInbox).toHaveBeenCalledWith(1, 500);
  });

  it('enforces IDOR protection for deletion and read state', async () => {
    const { service } = setup();
    await expect(service.delete(3, 'message-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.markRead(1, 'message-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('keeps sender and recipient deletion independent and purge-owned', async () => {
    const { service, messages } = setup();
    const row = message();
    messages.findByMessageId.mockResolvedValue(row);

    await service.delete(1, row.messageId);
    expect(row.deletedBySenderAt).toBeInstanceOf(Date);
    expect(row.deletedByRecipientAt).toBeNull();
    await expect(service.purge(2, row.messageId)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await service.delete(2, row.messageId);
    await service.purge(2, row.messageId);
    expect(messages.remove).toHaveBeenCalledWith(row.messageId);
  });

  it('does not overwrite read timestamps or save messages already read', async () => {
    const { service, messages } = setup();
    const row = message();
    row.readByRecipientAt = new Date('2026-01-01T00:00:00Z');
    messages.findByMessageId.mockResolvedValue(row);
    await service.markRead(2, row.messageId);
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('validates pagination peers and clamps every mailbox boundary', async () => {
    const { service, messages } = setup();
    await service.conversation(1, 2, -5);
    await service.outbox(1, Number.POSITIVE_INFINITY);
    await service.deleted(1, 0);
    expect(messages.findConversation).toHaveBeenCalledWith(1, 2, 1);
    expect(messages.findOutbox).toHaveBeenCalledWith(1, 500);
    expect(messages.findDeleted).toHaveBeenCalledWith(1, 100);
  });
});
