import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { userBanUntilAfterDays } from '../../../../user/public-api';
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
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async ban(command: BanAdminChatUserCommand) {
    assertUserId(command.userId);
    assertUserId(command.byUserId);
    assertDuration(command.durationDays);
    const user = await this.users.findById(command.userId);
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    let until: Date;
    try {
      until = userBanUntilAfterDays(
        command.durationDays ?? 3650,
        this.clock.now(),
      );
    } catch {
      throw new BadRequestException('Durée de bannissement invalide');
    }
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
    assertUserId(command.userId);
    assertUserId(command.byUserId);
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
    if (!normalized) return null;
    return normalized.length > 255 ? normalized.substring(0, 255) : normalized;
  }
}

function assertUserId(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException('Identifiant utilisateur invalide');
  }
}

function assertDuration(value: unknown): asserts value is number | null | undefined {
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 36_500)
  ) {
    throw new BadRequestException('Durée de bannissement invalide');
  }
}
