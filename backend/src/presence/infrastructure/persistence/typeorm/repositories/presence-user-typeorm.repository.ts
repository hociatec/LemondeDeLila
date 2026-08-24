import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { PresenceUserRepository } from '../../../../application/ports/presence-user.repository';
import type { PresenceUserChatBan } from '../../../../application/models/presence-user-chat-ban.model';
import { User } from '../../../../../user/public-api';

@Injectable()
export class PresenceUserTypeormRepository implements PresenceUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async findChatBanByUserId(userId: number): Promise<PresenceUserChatBan | null> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'chatBannedUntil', 'chatBanReason'] as const,
    });
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      chatBannedUntil: user.chatBannedUntil ?? null,
      chatBanReason: user.chatBanReason ?? null,
    };
  }
}
