import { Inject, Injectable } from '@nestjs/common';
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
    const items = await this.inbox.list(userId, limit);
    return items.map((item) => {
      const base = {
        id: item.id,
        kind: item.kind,
        contactId: item.contactId ?? null,
        createdAt: item.createdAt?.toISOString?.() ?? new Date().toISOString(),
        readAt: item.readAt?.toISOString?.() ?? null,
        fromUserId: item.fromUserId ?? 0,
        fromUsername: item.fromUsername ?? '',
        toUserId: item.toUserId ?? null,
        message: item.message ?? '',
        ...(item.payload ?? {}),
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
    const items = await this.inbox.list(userId, maxItems);
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
        latestCreatedAt:
          item.createdAt?.toISOString?.() ?? new Date().toISOString(),
        latestReadAt: item.readAt?.toISOString?.() ?? null,
        latestMessage: item.message ?? '',
        fromUserId: item.fromUserId ?? 0,
        fromUsername: item.fromUsername ?? '',
        toUserId: item.toUserId ?? null,
        unreadCount: item.readAt ? 0 : 1,
        ...normalized,
      });
    }
    return [...threads.values()].slice(0, limitThreads);
  }
}
