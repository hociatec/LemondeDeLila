import { BadRequestException, Injectable } from '@nestjs/common';

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
    durationDays?: number,
    bannedUntil?: string | null,
  ): Date | null {
    if (bannedUntil) {
      const parsed = new Date(bannedUntil);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Date de fin invalide');
      }
      return parsed;
    }

    if (durationDays && durationDays > 0) {
      const until = new Date();
      until.setDate(until.getDate() + durationDays);
      return until;
    }

    throw new BadRequestException('DurÃ©e ou date de fin requise');
  }
}
