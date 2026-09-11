import { BadRequestException, Injectable } from '@nestjs/common';
import {
  parseUserBanUntil,
  userBanUntilAfterDays,
} from '../../../../user/public-api';

@Injectable()
export class AdminUserBanPolicyService {
  sanitizeReason(reason: string): string {
    const raw = (reason ?? '').toString();
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      throw new BadRequestException('Motif requis');
    }
    return normalized.length > 255 ? normalized.substring(0, 255) : normalized;
  }

  resolveBannedUntil(
    nowMs: number,
    durationDays?: number,
    bannedUntil?: string | null,
  ): Date | null {
    try {
      if (!Number.isFinite(nowMs) || nowMs < 0) {
        throw new Error('nowMs invalide');
      }
      if (bannedUntil) return parseUserBanUntil(bannedUntil);
      if (
        durationDays !== undefined &&
        Number.isSafeInteger(durationDays) &&
        durationDays >= 0 &&
        durationDays <= 36500
      )
        return userBanUntilAfterDays(durationDays, nowMs);
    } catch {
      throw new BadRequestException('Durée ou date de fin invalide');
    }

    throw new BadRequestException('Durée ou date de fin requise');
  }
}
