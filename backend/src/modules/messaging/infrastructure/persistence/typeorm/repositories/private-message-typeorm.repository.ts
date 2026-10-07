import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import {
  type CreatePrivateMessageInput,
  type PrivateMessageRepository,
} from '../../../../application/ports/private-message.repository';
import type { PrivateMessageRecord } from '../../../../application/models/private-message.model';
import { PrivateMessageNotFoundError } from '../../../../domain/errors/private-message-domain.errors';
import { PrivateMessageEntity } from '../entities/private-message.entity';
import type { MessageUserPersistenceRef } from '../entities/message-user.persistence-ref';

@Injectable()
export class PrivateMessageTypeormRepository implements PrivateMessageRepository {
  private static readonly MAX_LIST_LIMIT = 200;
  constructor(
    @InjectRepository(PrivateMessageEntity)
    private readonly messages: Repository<PrivateMessageEntity>,
  ) {}

  async create(
    input: CreatePrivateMessageInput,
  ): Promise<PrivateMessageRecord> {
    const entity = this.messages.create({
      sender: { id: input.senderId } as MessageUserPersistenceRef,
      recipient: { id: input.recipientId } as MessageUserPersistenceRef,
      messageId: input.messageId,
      message: input.message,
      subject: input.subject,
      deletedBySenderAt: null,
      deletedByRecipientAt: null,
      readByRecipientAt: null,
    });
    const saved = await this.messages.save(entity);
    return this.getByIdOrThrow(saved.id);
  }

  async save(message: PrivateMessageRecord): Promise<PrivateMessageRecord> {
    // A stale reader must never reinsert a row physically purged in the meantime.
    const entity = this.toEntity(message);
    const { id, ...changes } = entity;
    await this.messages.update(id, changes);
    return this.getByIdOrThrow(message.id);
  }

  async findByMessageId(
    messageId: string,
    viewerId?: number,
  ): Promise<PrivateMessageRecord | null> {
    const message = await this.messages.findOne({
      where:
        viewerId === undefined
          ? { messageId }
          : [
              {
                messageId,
                sender: { id: viewerId },
                purgedBySenderAt: IsNull(),
              },
              {
                messageId,
                recipient: { id: viewerId },
                purgedByRecipientAt: IsNull(),
              },
            ],
    });
    return message ? this.toModel(message) : null;
  }

  async findConversation(
    currentUserId: number,
    otherUserId: number,
    limit: number,
  ): Promise<PrivateMessageRecord[]> {
    const items = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.recipient', 'recipient')
      .where(
        '(m.sender_id = :current AND m.recipient_id = :other AND m.deleted_by_sender_at IS NULL AND m.purged_by_sender_at IS NULL) OR (m.sender_id = :other AND m.recipient_id = :current AND m.deleted_by_recipient_at IS NULL AND m.purged_by_recipient_at IS NULL)',
      )
      .setParameters({ current: currentUserId, other: otherUserId })
      .orderBy('m.created_at', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .limit(this.normalizeLimit(limit))
      .getMany();
    return items.map((item) => this.toModel(item));
  }

  async findInbox(
    userId: number,
    limit: number,
  ): Promise<PrivateMessageRecord[]> {
    const items = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.recipient', 'recipient')
      .where(
        'm.recipient_id = :userId AND m.deleted_by_recipient_at IS NULL AND m.purged_by_recipient_at IS NULL',
        {
          userId,
        },
      )
      .orderBy('m.created_at', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(this.normalizeLimit(limit))
      .getMany();
    return items.map((item) => this.toModel(item));
  }

  async findOutbox(
    userId: number,
    limit: number,
  ): Promise<PrivateMessageRecord[]> {
    const items = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.recipient', 'recipient')
      .where(
        'm.sender_id = :userId AND m.deleted_by_sender_at IS NULL AND m.purged_by_sender_at IS NULL',
        {
          userId,
        },
      )
      .orderBy('m.created_at', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(this.normalizeLimit(limit))
      .getMany();
    return items.map((item) => this.toModel(item));
  }

  async findDeleted(
    userId: number,
    limit: number,
  ): Promise<PrivateMessageRecord[]> {
    const items = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.recipient', 'recipient')
      .addSelect(
        'CASE WHEN m.deleted_by_sender_at IS NOT NULL THEN m.deleted_by_sender_at ELSE m.deleted_by_recipient_at END',
        'deletionDate',
      )
      .where(
        '(m.sender_id = :userId AND m.deleted_by_sender_at IS NOT NULL AND m.purged_by_sender_at IS NULL) OR (m.recipient_id = :userId AND m.deleted_by_recipient_at IS NOT NULL AND m.purged_by_recipient_at IS NULL)',
        { userId },
      )
      .orderBy('deletionDate', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .limit(this.normalizeLimit(limit))
      .getMany();
    return items.map((item) => this.toModel(item));
  }

  async purgeForUser(messageId: string, userId: number): Promise<void> {
    await this.messages.manager.transaction(async (manager) => {
      const updated = await manager
        .createQueryBuilder()
        .update(PrivateMessageEntity)
        .set({
          purgedBySenderAt: () =>
            'CASE WHEN sender_id = :userId THEN CURRENT_TIMESTAMP ELSE purged_by_sender_at END',
          purgedByRecipientAt: () =>
            'CASE WHEN recipient_id = :userId THEN CURRENT_TIMESTAMP ELSE purged_by_recipient_at END',
        })
        .where(
          `message_id = :messageId AND (
        (sender_id = :userId AND deleted_by_sender_at IS NOT NULL AND purged_by_sender_at IS NULL) OR
        (recipient_id = :userId AND deleted_by_recipient_at IS NOT NULL AND purged_by_recipient_at IS NULL))`,
          { userId, messageId },
        )
        .execute();
      if (updated.affected !== 1)
        throw new PrivateMessageNotFoundError('Message absent de la corbeille');
      await manager
        .createQueryBuilder()
        .delete()
        .from(PrivateMessageEntity)
        .where(
          'message_id = :messageId AND purged_by_sender_at IS NOT NULL AND purged_by_recipient_at IS NOT NULL',
          { messageId },
        )
        .execute();
    });
  }

  async countUnreadForRecipient(userId: number): Promise<number> {
    return this.messages
      .createQueryBuilder('m')
      .where('m.recipient_id = :userId', { userId })
      .andWhere('m.deleted_by_recipient_at IS NULL')
      .andWhere('m.purged_by_recipient_at IS NULL')
      .andWhere('m.read_by_recipient_at IS NULL')
      .getCount();
  }

  private async getByIdOrThrow(id: number): Promise<PrivateMessageRecord> {
    const message = await this.messages.findOne({ where: { id } });
    if (!message) {
      throw new PrivateMessageNotFoundError(
        `Private message ${id} not found after save`,
      );
    }
    return this.toModel(message);
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isSafeInteger(limit) || limit < 1) return 1;
    return Math.min(limit, PrivateMessageTypeormRepository.MAX_LIST_LIMIT);
  }

  private toEntity(message: PrivateMessageRecord): PrivateMessageEntity {
    return this.messages.create({
      id: message.id,
      messageId: message.messageId,
      sender: { id: message.sender.id } as MessageUserPersistenceRef,
      recipient: { id: message.recipient.id } as MessageUserPersistenceRef,
      message: message.message,
      subject: message.subject,
      createdAt: message.createdAt,
      deletedBySenderAt: message.deletedBySenderAt,
      deletedByRecipientAt: message.deletedByRecipientAt,
      readByRecipientAt: message.readByRecipientAt,
    });
  }

  private toModel(message: PrivateMessageEntity): PrivateMessageRecord {
    return {
      id: message.id,
      messageId: message.messageId,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
      },
      recipient: {
        id: message.recipient.id,
        username: message.recipient.username,
      },
      message: message.message,
      subject: message.subject ?? null,
      createdAt: message.createdAt,
      deletedBySenderAt: message.deletedBySenderAt ?? null,
      deletedByRecipientAt: message.deletedByRecipientAt ?? null,
      readByRecipientAt: message.readByRecipientAt ?? null,
    };
  }
}
