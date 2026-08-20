import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_USER_REPOSITORY,
  type AdminUserRepository,
} from '../../ports/admin-user.repository';

export interface BanAdminChatUserCommand {
  userId: number;
  reason?: string | null;
  durationDays?: number | null;
  byUserId: number;
}

export interface UnbanAdminChatUserCommand {
  userId: number;
  byUserId: number;
}

@Injectable()
export class AdminChatModerationService {
  constructor(
    @Inject(ADMIN_USER_REPOSITORY)
    private readonly users: AdminUserRepository,
  ) {}

  async ban(command: BanAdminChatUserCommand) {
    const user = await this.users.findById(command.userId);
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    const days =
      command.durationDays && command.durationDays > 0
        ? command.durationDays
        : 3650;
    const until = new Date(Date.now() + days * 24 * 60 * 60_000);
    user.chatBannedUntil = until;
    user.chatBanReason = this.normalizeReason(command.reason);
    await this.users.save(user);

    return {
      ok: true,
      userId: user.id,
      chatBannedUntil: until.toISOString(),
      chatBanReason: user.chatBanReason,
      byUserId: command.byUserId,
    };
  }

  async unban(command: UnbanAdminChatUserCommand) {
    const user = await this.users.findById(command.userId);
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    user.chatBannedUntil = null;
    user.chatBanReason = null;
    await this.users.save(user);

    return {
      ok: true,
      userId: user.id,
      byUserId: command.byUserId,
    };
  }

  private normalizeReason(reason?: string | null): string | null {
    const normalized = (reason ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
