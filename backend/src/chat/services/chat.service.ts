import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ChatMessage } from '../entities/chat-message.entity';
import { User } from '../../user/entities/user.entity';
import { ChatValidator } from './chat.validator';
import { IsNull } from 'typeorm';

@Injectable()
export class ChatService {
  private static readonly DEFAULT_HISTORY_LIMIT = 200;

  constructor(
    @InjectRepository(ChatMessage)
    private readonly messages: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly validator: ChatValidator,
  ) {}

  async recordMessage(userId: number, text: string): Promise<ChatMessage> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    const sanitized = this.validator.validate(text);
    const message = this.messages.create({
      user,
      message: sanitized,
      messageId: this.generateMessageId(),
      createdAt: new Date(),
    });
    return this.messages.save(message);
  }

  async getRecentMessages(
    limit = ChatService.DEFAULT_HISTORY_LIMIT,
    since?: Date,
  ): Promise<ChatMessage[]> {
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.deletedAt IS NULL')
      .orderBy('m.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 500));

    if (since) {
      qb.andWhere('m.createdAt >= :since', { since });
    }

    const rows = await qb.getMany();
    return rows.reverse(); // renvoyer dans l'ordre chronologique
  }

  normalize(message: ChatMessage): Record<string, unknown> {
    const created =
      message.createdAt instanceof Date ? message.createdAt : new Date();
    const createdIso = isFinite(created.getTime())
      ? created.toISOString()
      : new Date().toISOString();

    return {
      type: 'chat-message',
      id: message.messageId,
      text: message.message,
      createdAt: createdIso,
      user: {
        id: message.user?.id,
        username: message.user?.username,
        avatar: message.user?.avatar ?? null,
      },
    };
  }

  normalizeMany(messages: ChatMessage[]): Array<Record<string, unknown>> {
    return messages.map((m) => this.normalize(m));
  }

  async adminListMessages(
    limit = ChatService.DEFAULT_HISTORY_LIMIT,
    includeDeleted = false,
  ): Promise<ChatMessage[]> {
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .orderBy('m.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 1000));

    // NOTE: on garde le paramètre includeDeleted pour compatibilité protocolaire,
    // mais côté produit la suppression est définitive (pas de corbeille).
    if (!includeDeleted) qb.where({ deletedAt: IsNull() });

    const rows = await qb.getMany();
    return rows.reverse();
  }

  async adminDeleteMessage(messageId: string): Promise<boolean> {
    const id = (messageId || '').trim();
    if (!id) return false;
    const res = await this.messages.delete({ messageId: id });
    return (res.affected ?? 0) > 0;
  }

  async adminClearAll(): Promise<number> {
    // Suppression définitive.
    const res = await this.messages
      .createQueryBuilder()
      .delete()
      .from(ChatMessage)
      .execute();
    return res.affected ?? 0;
  }

  private generateMessageId(): string {
    return randomBytes(8).toString('hex');
  }
}
