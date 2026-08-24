import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  type CreatePrivateMessageInput,
  type PrivateMessageRepository,
} from '../../../../application/ports/private-message.repository';
import type { PrivateMessageRecord } from '../../../../application/models/private-message.model';
import { PrivateMessageNotFoundError } from '../../../../domain/errors/private-message-domain.errors';
import { User } from '../../../../../user/public-api';
import { PrivateMessageEntity } from '../entities/private-message.entity';

@Injectable()
export class PrivateMessageTypeormRepository
  implements PrivateMessageRepository
{
  constructor(
    @InjectRepository(PrivateMessageEntity)
    private readonly messages: Repository<PrivateMessageEntity>,
  ) {}

  async create(input: CreatePrivateMessageInput): Promise<PrivateMessageRecord> {
    const entity = this.messages.create({
      sender: { id: input.senderId } as User,
      recipient: { id: input.recipientId } as User,
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
    await this.messages.save(this.toEntity(message));
    return this.getByIdOrThrow(message.id);
  }

  async findByMessageId(messageId: string): Promise<PrivateMessageRecord | null> {
    const message = await this.messages.findOne({ where: { messageId } });
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
        '(m.sender_id = :current AND m.recipient_id = :other AND m.deleted_by_sender_at IS NULL) OR (m.sender_id = :other AND m.recipient_id = :current AND m.deleted_by_recipient_at IS NULL)',
      )
      .setParameters({ current: currentUserId, other: otherUserId })
      .orderBy('m.created_at', 'ASC')
      .limit(limit)
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
      .where('m.recipient_id = :userId AND m.deleted_by_recipient_at IS NULL', {
        userId,
      })
      .orderBy('m.created_at', 'DESC')
      .limit(limit)
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
      .where('m.sender_id = :userId AND m.deleted_by_sender_at IS NULL', {
        userId,
      })
      .orderBy('m.created_at', 'DESC')
      .limit(limit)
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
        '(m.sender_id = :userId AND m.deleted_by_sender_at IS NOT NULL) OR (m.recipient_id = :userId AND m.deleted_by_recipient_at IS NOT NULL)',
        { userId },
      )
      .orderBy('deletionDate', 'DESC')
      .limit(limit)
      .getMany();
    return items.map((item) => this.toModel(item));
  }

  async remove(messageId: string): Promise<void> {
    await this.messages.delete({ messageId });
  }

  async countUnreadForRecipient(userId: number): Promise<number> {
    return this.messages
      .createQueryBuilder('m')
      .where('m.recipient_id = :userId', { userId })
      .andWhere('m.deleted_by_recipient_at IS NULL')
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

  private toEntity(message: PrivateMessageRecord): PrivateMessageEntity {
    return this.messages.create({
      id: message.id,
      messageId: message.messageId,
      sender: { id: message.sender.id } as User,
      recipient: { id: message.recipient.id } as User,
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
