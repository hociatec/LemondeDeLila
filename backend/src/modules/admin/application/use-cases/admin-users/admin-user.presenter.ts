import { serializeOptionalDate } from '../../../../../shared/utils/public-api';
import type { AdminSafeUser } from '../../../domain/models/admin-user.model';

export function presentAdminUser(user: AdminSafeUser) {
  return {
    ...user,
    bannedUntil: serializeOptionalDate(user.bannedUntil),
    chatBannedUntil: serializeOptionalDate(user.chatBannedUntil),
    createdAt: serializeOptionalDate(user.createdAt),
  };
}
