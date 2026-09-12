import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PresenceUserRepository } from '../../../../application/ports/presence-user.repository';
import type { PresenceUserChatBan } from '../../../../application/models/presence-user-chat-ban.model';

type UserRow = {
  id?: unknown;
  chat_banned_until?: Date | string | null;
  chat_ban_reason?: string | null;
};

@Injectable()
export class PresenceUserTypeormRepository implements PresenceUserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findChatBanByUserId(
    userId: number,
  ): Promise<PresenceUserChatBan | null> {
    const rows = await this.dataSource.query<UserRow[]>(
      'SELECT id, chat_banned_until, chat_ban_reason FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    const user = rows[0];
    if (!user) return null;
    const normalizedUserId = toPositiveSafeId(user?.id);
    if (normalizedUserId === null) return null;
    const chatBannedUntil =
      user.chat_banned_until != null ? new Date(user.chat_banned_until) : null;
    if (chatBannedUntil && Number.isNaN(chatBannedUntil.getTime())) return null;
    return {
      id: normalizedUserId,
      chatBannedUntil,
      chatBanReason:
        typeof user.chat_ban_reason === 'string'
          ? user.chat_ban_reason.slice(0, 255)
          : null,
    };
  }
}

function toPositiveSafeId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
