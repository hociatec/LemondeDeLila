import { Inject, Injectable } from '@nestjs/common';
import {
  serializeDate,
  serializeOptionalDate,
} from '../../../../shared/utils/public-api';
import {
  NOTIFICATION_INBOX_REPOSITORY,
  type NotificationInboxRepository,
} from '../ports/notification-inbox.repository';
import type { AdminContactThreadSummary } from '../models/admin-contact.model';
import {
  ADMIN_CONTACT_KIND,
  normalizeAdminContactPayload,
} from './admin-contact-normalization';

@Injectable()
export class AdminContactQueryService {
  constructor(
    @Inject(NOTIFICATION_INBOX_REPOSITORY)
    private readonly inbox: NotificationInboxRepository,
  ) {}

  async listInbox(
    userId: number,
    limit = 100,
  ): Promise<Array<Record<string, unknown>>> {
    const safeLimit = Number.isSafeInteger(limit)
      ? Math.min(Math.max(limit, 1), 200)
      : 100;
    const items = await this.inbox.list(userId, safeLimit);
    return items.map((item) => {
      const base = {
        ...(item.payload ?? {}),
        id: item.id,
        kind: item.kind,
        contactId: item.contactId ?? null,
        createdAt: serializeDate(item.createdAt),
        readAt: serializeOptionalDate(item.readAt),
        fromUserId: item.fromUserId ?? 0,
        fromUsername: item.fromUsername ?? '',
        toUserId: item.toUserId ?? null,
        message: item.message ?? '',
      };
      if (item.kind !== ADMIN_CONTACT_KIND) return base;
      return { ...base, ...normalizeAdminContactPayload(item.payload) };
    });
  }

  async listThreads(
    userId: number,
    {
      maxItems = 1000,
      limitThreads = 200,
    }: { maxItems?: number; limitThreads?: number } = {},
  ): Promise<AdminContactThreadSummary[]> {
    const safeMaxItems = Number.isSafeInteger(maxItems)
      ? Math.min(Math.max(maxItems, 1), 200)
      : 200;
    const safeLimitThreads = Number.isSafeInteger(limitThreads)
      ? Math.min(Math.max(limitThreads, 1), 200)
      : 200;
    const items = await this.inbox.list(userId, safeMaxItems);
    const threads = new Map<string, AdminContactThreadSummary>();
    for (const item of items) {
      if (item.kind !== ADMIN_CONTACT_KIND || !item.contactId) continue;
      const existing = threads.get(item.contactId);
      if (existing) {
        existing.unreadCount += item.readAt ? 0 : 1;
        continue;
      }
      const normalized = normalizeAdminContactPayload(item.payload);
      threads.set(item.contactId, {
        kind: 'admin_contact',
        contactId: item.contactId,
        latestId: item.id,
        latestCreatedAt: serializeDate(item.createdAt),
        latestReadAt: serializeOptionalDate(item.readAt),
        latestMessage: item.message ?? '',
        fromUserId: item.fromUserId ?? 0,
        fromUsername: item.fromUsername ?? '',
        toUserId: item.toUserId ?? null,
        unreadCount: item.readAt ? 0 : 1,
        ...normalized,
      });
    }
    return [...threads.values()].slice(0, safeLimitThreads);
  }
}
