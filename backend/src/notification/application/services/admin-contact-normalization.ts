import { stringOrEmpty } from '@common/utils/public-api';
import type { NotificationInboxPayload } from '../models/notification-inbox-item.model';
import type { AdminContactStatus } from '../models/admin-contact.model';

export const ADMIN_CONTACT_KIND = 'admin_contact';

export type NormalizedAdminContactPayload = {
  status: AdminContactStatus;
  handled: boolean;
  statusAt: string | null;
  statusByUserId: number | null;
  statusByUsername: string | null;
  handledAt: string | null;
  handledByUserId: number | null;
  handledByUsername: string | null;
};

export function normalizeAdminContactStatus(
  value: unknown,
): AdminContactStatus {
  const status = stringOrEmpty(value).trim().toLowerCase();
  if (status === 'handled' || status === 'done' || status === 'resolved') {
    return 'handled';
  }
  if (
    status === 'in_progress' ||
    status === 'in progress' ||
    status === 'progress'
  ) {
    return 'in_progress';
  }
  return 'open';
}

export function normalizeAdminContactPayload(
  payload: NotificationInboxPayload,
): NormalizedAdminContactPayload {
  const value = payload ?? {};
  const status = normalizeAdminContactStatus(value.status);
  const handled = status === 'handled' || Boolean(value.handled);
  return {
    status: handled ? 'handled' : status,
    handled,
    statusAt: typeof value.statusAt === 'string' ? value.statusAt : null,
    statusByUserId:
      typeof value.statusByUserId === 'number' ? value.statusByUserId : null,
    statusByUsername:
      typeof value.statusByUsername === 'string'
        ? value.statusByUsername
        : null,
    handledAt: typeof value.handledAt === 'string' ? value.handledAt : null,
    handledByUserId:
      typeof value.handledByUserId === 'number' ? value.handledByUserId : null,
    handledByUsername:
      typeof value.handledByUsername === 'string'
        ? value.handledByUsername
        : null,
  };
}
