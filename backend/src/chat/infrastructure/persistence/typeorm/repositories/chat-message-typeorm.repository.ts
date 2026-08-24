import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ChatMessageRecord } from '../../../../application/models/chat-message.record';
import {
  ChatMessageRepository,
  CreateChatMessageInput,
} from '../../../../application/ports/chat-message.repository';
import { ChatMessageNotFoundError } from '../../../../domain/errors/chat-domain.errors';
import { ChatMessage } from '../entities/chat-message.entity';

@Injectable()
export class ChatMessageTypeormRepository implements ChatMessageRepository {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messages: Repository<ChatMessage>,
  ) {}

  async create(input: CreateChatMessageInput): Promise<ChatMessageRecord> {
    const message = this.messages.create({
      user: { id: input.userId } as ChatMessage['user'],
      message: input.message,
      messageId: input.messageId,
      createdAt: input.createdAt,
    });

    const saved = await this.messages.save(message);
    return this.findByIdOrFail(saved.id);
  }

  async listRecent(limit: number, since?: Date): Promise<ChatMessageRecord[]> {
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.deletedAt IS NULL')
      .orderBy('m.createdAt', 'DESC')
      .take(limit);

    if (since) {
      qb.andWhere('m.createdAt >= :since', { since });
    }

    const rows = await qb.getMany();
    return rows.reverse().map((row) => this.toRecord(row));
  }

  async listForAdmin(
    limit: number,
    includeDeleted: boolean,
  ): Promise<ChatMessageRecord[]> {
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .orderBy('m.createdAt', 'DESC')
      .take(limit);

    if (!includeDeleted) {
      qb.where({ deletedAt: IsNull() });
    }

    const rows = await qb.getMany();
    return rows.reverse().map((row) => this.toRecord(row));
  }

  async findByMessageId(messageId: string): Promise<ChatMessageRecord | null> {
    const row = await this.messages.findOne({
      where: { messageId },
      relations: ['user'],
    });
    return row ? this.toRecord(row) : null;
  }

  async updateMessage(id: number, message: string): Promise<ChatMessageRecord> {
    await this.messages.update({ id }, { message });
    return this.findByIdOrFail(id);
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.messages.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async deleteByMessageId(messageId: string): Promise<boolean> {
    const result = await this.messages.delete({ messageId });
    return (result.affected ?? 0) > 0;
  }

  async deleteAll(): Promise<number> {
    const result = await this.messages
      .createQueryBuilder()
      .delete()
      .from(ChatMessage)
      .execute();
    return result.affected ?? 0;
  }

  private async findByIdOrFail(id: number): Promise<ChatMessageRecord> {
    const row = await this.messages.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!row) {
      throw new ChatMessageNotFoundError(`Message introuvable (id=${id}).`);
    }
    return this.toRecord(row);
  }

  private toRecord(entity: ChatMessage): ChatMessageRecord {
    return {
      id: entity.id,
      messageId: entity.messageId,
      message: entity.message,
      createdAt: entity.createdAt,
      deletedAt: entity.deletedAt,
      user: entity.user
        ? {
            id: entity.user.id,
            username: entity.user.username,
            avatar: entity.user.avatar ?? null,
            chatBannedUntil: entity.user.chatBannedUntil ?? null,
            chatBanReason: entity.user.chatBanReason ?? null,
          }
        : null,
    };
  }
}
