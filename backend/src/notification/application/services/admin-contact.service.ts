import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { WsAuthPayload } from '../../../common/interfaces/public-api';
import {
  NOTIFICATION_INBOX_REPOSITORY,
  type NotificationInboxRepository,
} from '../ports/notification-inbox.repository';
import {
  NOTIFICATION_INBOX_NOTIFIER,
  type NotificationInboxNotifier,
} from '../ports/notification-inbox-notifier.port';
import {
  USER_BADGE_COUNTS_NOTIFIER,
  type UserBadgeCountsNotifier,
} from '../ports/user-badge-counts-notifier.port';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../../user/public-api';
import {
  NotificationAccessDeniedError,
  NotificationContactIdRequiredError,
  NotificationContactNotFoundError,
  NotificationMessageRequiredError,
  NotificationMessageTooLongError,
  NotificationRecipientInvalidError,
} from '../../domain/errors/notification-domain.errors';
import type {
  NotificationInboxPayload,
} from '../models/notification-inbox-item.model';
import { stringOrEmpty } from '@common/utils/public-api';

export type AdminContactItem = {
  kind: 'admin_contact';
  contactId: string;
  message: string;
  fromUserId: number;
  fromUsername: string;
  // When staff replies, the target user id is included.
  toUserId?: number;
  id: string;
  createdAt: string;
  readAt?: string | null;
  status?: AdminContactStatus;
  handled?: boolean;
  statusAt?: string | null;
  statusByUserId?: number | null;
  statusByUsername?: string | null;
  handledAt?: string | null;
  handledByUserId?: number | null;
  handledByUsername?: string | null;
};

export type AdminContactThreadSummary = {
  kind: 'admin_contact';
  contactId: string;
  latestId: string;
  latestCreatedAt: string;
  latestReadAt?: string | null;
  latestMessage: string;
  fromUserId: number;
  fromUsername: string;
  toUserId?: number | null;
  unreadCount: number;
  status: AdminContactStatus;
  handled: boolean;
  statusAt?: string | null;
  statusByUserId?: number | null;
  statusByUsername?: string | null;
  handledAt?: string | null;
  handledByUserId?: number | null;
  handledByUsername?: string | null;
};

export type AdminContactStatus = 'open' | 'in_progress' | 'handled';

@Injectable()
export class AdminContactService {
  private readonly logger = new Logger(AdminContactService.name);
  private static readonly ADMIN_CONTACT_KIND = 'admin_contact';

  constructor(
    @Inject(NOTIFICATION_INBOX_REPOSITORY)
    private readonly inbox: NotificationInboxRepository,
    @Inject(NOTIFICATION_INBOX_NOTIFIER)
    private readonly inboxNotifier: NotificationInboxNotifier,
    @Inject(USER_BADGE_COUNTS_NOTIFIER)
    private readonly counts: UserBadgeCountsNotifier,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
  ) {}

  private isStaffRoles(roles: unknown): boolean {
    const arr = Array.isArray(roles) ? roles.map((r) => String(r)) : [];
    return (
      arr.includes('ROLE_ADMIN') ||
      arr.includes('admin') ||
      arr.includes('ROLE_MODERATOR') ||
      arr.includes('moderator')
    );
  }

  private async listStaffUserIds(): Promise<number[]> {
    const all = await this.users.listStaff();
    return all
      .map((user) => user.id)
      .filter((id) => typeof id === 'number' && id > 0);
  }

  private static normalizeContactStatus(value: unknown): AdminContactStatus {
    const v = stringOrEmpty(value).trim().toLowerCase();
    if (v === 'handled' || v === 'done' || v === 'resolved') return 'handled';
    if (v === 'in_progress' || v === 'in progress' || v === 'progress')
      return 'in_progress';
    return 'open';
  }

  private static normalizeContactPayload(payload: NotificationInboxPayload): {
    status: AdminContactStatus;
    handled: boolean;
    statusAt: string | null;
    statusByUserId: number | null;
    statusByUsername: string | null;
    handledAt: string | null;
    handledByUserId: number | null;
    handledByUsername: string | null;
  } {
    const obj = payload ?? {};
    const normalizedStatus = AdminContactService.normalizeContactStatus(
      obj.status,
    );
    const handled = normalizedStatus === 'handled' || Boolean(obj.handled);
    return {
      status: handled ? 'handled' : normalizedStatus,
      handled,
      statusAt: typeof obj.statusAt === 'string' ? obj.statusAt : null,
      statusByUserId:
        typeof obj.statusByUserId === 'number' ? obj.statusByUserId : null,
      statusByUsername:
        typeof obj.statusByUsername === 'string' ? obj.statusByUsername : null,
      handledAt: typeof obj.handledAt === 'string' ? obj.handledAt : null,
      handledByUserId:
        typeof obj.handledByUserId === 'number' ? obj.handledByUserId : null,
      handledByUsername:
        typeof obj.handledByUsername === 'string'
          ? obj.handledByUsername
          : null,
    };
  }

  async listInbox(
    userId: number,
    limit = 100,
  ): Promise<Array<Record<string, unknown>>> {
    const items = await this.inbox.list(userId, limit);
    return items.map((it) => {
      const base = {
        id: it.id,
        kind: it.kind,
        contactId: it.contactId ?? null,
        createdAt: it.createdAt?.toISOString?.() ?? new Date().toISOString(),
        readAt: it.readAt?.toISOString?.() ?? null,
        fromUserId: it.fromUserId ?? 0,
        fromUsername: it.fromUsername ?? '',
        toUserId: it.toUserId ?? null,
        message: it.message ?? '',
        ...(it.payload ?? {}),
      };

      if (it.kind !== AdminContactService.ADMIN_CONTACT_KIND) return base;

      const normalized = AdminContactService.normalizeContactPayload(
        it.payload,
      );
      return {
        ...base,
        status: normalized.status,
        handled: normalized.handled,
        statusAt: normalized.statusAt,
        statusByUserId: normalized.statusByUserId,
        statusByUsername: normalized.statusByUsername,
        handledAt: normalized.handledAt,
        handledByUserId: normalized.handledByUserId,
        handledByUsername: normalized.handledByUsername,
      };
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

    for (const it of items) {
      if (it.kind !== AdminContactService.ADMIN_CONTACT_KIND) continue;
      const contactId = it.contactId ?? '';
      if (!contactId) continue;

      const existing = threads.get(contactId);
      const unreadInc = it.readAt ? 0 : 1;

      if (!existing) {
        const normalized = AdminContactService.normalizeContactPayload(
          it.payload,
        );
        threads.set(contactId, {
          kind: 'admin_contact',
          contactId,
          latestId: it.id,
          latestCreatedAt:
            it.createdAt?.toISOString?.() ?? new Date().toISOString(),
          latestReadAt: it.readAt?.toISOString?.() ?? null,
          latestMessage: it.message ?? '',
          fromUserId: it.fromUserId ?? 0,
          fromUsername: it.fromUsername ?? '',
          toUserId: it.toUserId ?? null,
          unreadCount: unreadInc,
          status: normalized.status,
          handled: normalized.handled,
          statusAt: normalized.statusAt,
          statusByUserId: normalized.statusByUserId,
          statusByUsername: normalized.statusByUsername,
          handledAt: normalized.handledAt,
          handledByUserId: normalized.handledByUserId,
          handledByUsername: normalized.handledByUsername,
        });
        continue;
      }

      existing.unreadCount += unreadInc;
      // Items are already sorted by createdAt DESC, so the first entry for a contactId is the latest.
    }

    return Array.from(threads.values()).slice(0, limitThreads);
  }

  async cycleStatusForContact(
    from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>,
    contactId: string,
  ): Promise<{ status: 'open' | 'in_progress' | 'handled' }> {
    if (!this.isStaffRoles(from.roles)) {
      throw new NotificationAccessDeniedError();
    }
    const cid = String(contactId || '').trim();
    if (!cid) throw new NotificationContactIdRequiredError();

    const rows = await this.inbox.listByContactId(
      AdminContactService.ADMIN_CONTACT_KIND,
      cid,
    );
    if (rows.length === 0) return { status: 'open' };

    const current = AdminContactService.normalizeContactPayload(
      rows[0].payload,
    );
    const next =
      current.status === 'open'
        ? 'in_progress'
        : current.status === 'in_progress'
          ? 'handled'
          : 'open';

    await this.setStatusForContact(from, cid, next);
    return { status: next };
  }

  async cycleStatusForInboxItem(
    from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>,
    userId: number,
    inboxItemId: string,
  ): Promise<{ status: AdminContactStatus }> {
    if (!this.isStaffRoles(from.roles)) {
      throw new NotificationAccessDeniedError();
    }
    const item = await this.inbox.getByIdForUser(userId, inboxItemId);
    const cid =
      item?.kind === AdminContactService.ADMIN_CONTACT_KIND
        ? (item.contactId ?? '')
        : '';
    if (!cid) throw new NotificationContactNotFoundError();
    return this.cycleStatusForContact(from, cid);
  }

  async setStatusForInboxItem(
    from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>,
    userId: number,
    inboxItemId: string,
    status: unknown,
  ): Promise<void> {
    if (!this.isStaffRoles(from.roles)) {
      throw new NotificationAccessDeniedError();
    }
    const item = await this.inbox.getByIdForUser(userId, inboxItemId);
    const cid =
      item?.kind === AdminContactService.ADMIN_CONTACT_KIND
        ? (item.contactId ?? '')
        : '';
    if (!cid) throw new NotificationContactNotFoundError();
    await this.setStatusForContact(from, cid, status);
  }

  async deleteInboxItem(userId: number, id: string): Promise<void> {
    const ok = await this.inbox.delete(userId, id);
    this.logger.log(`Inbox delete user=${userId} id=${id} ok=${ok}`);
    const items = await this.inbox.list(userId, 5);
    const ids = items.map((it) => it.id).join(',');
    this.logger.log(
      `Inbox after delete user=${userId} remaining=${items.length} ids=[${ids}]`,
    );
    await this.counts.notifyCounts(userId);
  }

  async markRead(userId: number, id: string): Promise<void> {
    await this.inbox.markRead(userId, id);
    await this.counts.notifyCounts(userId);
  }

  async sendFromUserToStaff(
    from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>,
    message: string,
    contactId?: string,
  ): Promise<AdminContactItem> {
    const clean = String(message || '').trim();
    if (!clean) {
      throw new NotificationMessageRequiredError();
    }
    if (clean.length > 2000) {
      throw new NotificationMessageTooLongError();
    }

    const staffIds = await this.listStaffUserIds();

    const cid = contactId || randomUUID();
    const createdAt = new Date();
    const baseItem: Omit<AdminContactItem, 'id'> = {
      kind: 'admin_contact',
      contactId: cid,
      createdAt: createdAt.toISOString(),
      message: clean,
      fromUserId: from.id,
      fromUsername: from.username,
      status: 'open',
      handled: false,
    };

    const recipients = new Set<number>([from.id, ...staffIds]);

    const firstRowId = randomUUID();
    const rowIds = Array.from(recipients).map((uid, i) => ({
      uid,
      rowId: i === 0 ? firstRowId : randomUUID(),
    }));

    await Promise.all(
      rowIds.map(async ({ uid, rowId }) => {
        const item: AdminContactItem = { ...baseItem, id: rowId };
        await this.inbox.create({
          id: rowId,
          userId: uid,
          kind: AdminContactService.ADMIN_CONTACT_KIND,
          createdAt,
          contactId: cid,
          fromUserId: from.id,
          fromUsername: from.username,
          toUserId: null,
          message: clean,
          payload: {
            status: 'open',
            handled: false,
            statusAt: null,
            statusByUserId: null,
            statusByUsername: null,
          },
        });
        try {
          await this.inboxNotifier.notifyInboxItem(uid, item);
        } catch (err) {
          this.logger.warn(
            `notify.inbox.item failed for user ${uid}: ${(err as Error).message}`,
          );
        }
        try {
          await this.counts.notifyCounts(uid);
        } catch (err) {
          this.logger.warn(
            `notifyCounts failed for user ${uid}: ${(err as Error).message}`,
          );
        }
      }),
    );

    return { ...baseItem, id: firstRowId };
  }

  async replyFromStaffToUser(
    from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>,
    toUserId: number,
    message: string,
    contactId: string,
  ): Promise<AdminContactItem> {
    if (!this.isStaffRoles(from.roles)) {
      throw new NotificationAccessDeniedError();
    }
    if (!toUserId || toUserId <= 0) {
      throw new NotificationRecipientInvalidError();
    }
    const clean = String(message || '').trim();
    if (!clean) {
      throw new NotificationMessageRequiredError();
    }
    if (clean.length > 2000) {
      throw new NotificationMessageTooLongError();
    }
    const cid = String(contactId || '').trim();
    if (!cid) {
      throw new NotificationContactIdRequiredError();
    }

    const staffIds = await this.listStaffUserIds();

    const createdAt = new Date();
    const baseItem: Omit<AdminContactItem, 'id'> = {
      kind: 'admin_contact',
      contactId: cid,
      createdAt: createdAt.toISOString(),
      message: clean,
      fromUserId: from.id,
      fromUsername: from.username,
      toUserId,
      status: 'open',
      handled: false,
    };

    const recipients = new Set<number>([toUserId, ...staffIds]);

    const firstRowId = randomUUID();
    const rowIds = Array.from(recipients).map((uid, i) => ({
      uid,
      rowId: i === 0 ? firstRowId : randomUUID(),
    }));

    await Promise.all(
      rowIds.map(async ({ uid, rowId }) => {
        const item: AdminContactItem = { ...baseItem, id: rowId };
        await this.inbox.create({
          id: rowId,
          userId: uid,
          kind: AdminContactService.ADMIN_CONTACT_KIND,
          createdAt,
          contactId: cid,
          fromUserId: from.id,
          fromUsername: from.username,
          toUserId,
          message: clean,
          payload: {
            status: 'open',
            handled: false,
            statusAt: null,
            statusByUserId: null,
            statusByUsername: null,
          },
        });
        try {
          await this.inboxNotifier.notifyInboxItem(uid, item);
        } catch (err) {
          this.logger.warn(
            `notify.inbox.item failed for user ${uid}: ${(err as Error).message}`,
          );
        }
        try {
          await this.counts.notifyCounts(uid);
        } catch (err) {
          this.logger.warn(
            `notifyCounts failed for user ${uid}: ${(err as Error).message}`,
          );
        }
      }),
    );

    return { ...baseItem, id: firstRowId };
  }

  async setHandledForContact(
    from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>,
    contactId: string,
    handled: boolean,
  ): Promise<void> {
    await this.setStatusForContact(
      from,
      contactId,
      handled ? 'handled' : 'open',
    );
  }

  async setStatusForContact(
    from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>,
    contactId: string,
    status: unknown,
  ): Promise<void> {
    if (!this.isStaffRoles(from.roles)) {
      throw new NotificationAccessDeniedError();
    }

    const cid = String(contactId || '').trim();
    if (!cid) {
      throw new NotificationContactIdRequiredError();
    }

    const normalizedStatus = AdminContactService.normalizeContactStatus(status);
    const rows = await this.inbox.listByContactId(
      AdminContactService.ADMIN_CONTACT_KIND,
      cid,
    );
    if (rows.length === 0) {
      return;
    }

    const now = new Date();
    const isHandled = normalizedStatus === 'handled';

    await Promise.all(
      rows.map(async (row) => {
        const prev = row.payload ?? {};

        const nextPayload = {
          ...prev,
          status: normalizedStatus,
          handled: isHandled,
          statusAt: now.toISOString(),
          statusByUserId: from.id,
          statusByUsername: from.username,
          handledAt: isHandled ? now.toISOString() : null,
          handledByUserId: isHandled ? from.id : null,
          handledByUsername: isHandled ? from.username : null,
        };

        await this.inbox.updatePayload(row.id, nextPayload);

        const item: AdminContactItem = {
          kind: 'admin_contact',
          id: row.id,
          contactId: cid,
          createdAt: row.createdAt.toISOString(),
          readAt: row.readAt?.toISOString?.() ?? null,
          fromUserId: row.fromUserId ?? 0,
          fromUsername: row.fromUsername ?? '',
          toUserId: row.toUserId ?? undefined,
          message: row.message ?? '',
          status: normalizedStatus,
          handled: isHandled,
          statusAt: nextPayload.statusAt,
          statusByUserId: nextPayload.statusByUserId,
          statusByUsername: nextPayload.statusByUsername,
          handledAt: nextPayload.handledAt,
          handledByUserId: nextPayload.handledByUserId,
          handledByUsername: nextPayload.handledByUsername,
        };

        try {
          await this.inboxNotifier.notifyInboxItem(row.userId, item);
        } catch (err) {
          this.logger.warn(
            `notify.inbox.item failed for user ${row.userId}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }

  async deleteThreadForContact(
    from: Pick<WsAuthPayload, 'id' | 'username' | 'roles'>,
    contactId: string,
  ): Promise<void> {
    if (!this.isStaffRoles(from.roles)) {
      throw new NotificationAccessDeniedError();
    }

    const cid = String(contactId || '').trim();
    if (!cid) {
      throw new NotificationContactIdRequiredError();
    }

    const rows = await this.inbox.listByContactId('admin_contact', cid);
    if (rows.length === 0) {
      return;
    }

    const byUser = new Map<number, string[]>();
    for (const row of rows) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row.id);
      byUser.set(row.userId, list);
    }

    await this.inbox.deleteManyByIds(rows.map((r) => r.id));

    await Promise.all(
      Array.from(byUser.entries()).map(async ([userId, ids]) => {
        try {
          await this.inboxNotifier.notifyInboxRemoved(userId, {
            ids,
            contactId: cid,
          });
        } catch (err) {
          this.logger.warn(
            `notify.inbox.removed failed for user ${userId}: ${(err as Error).message}`,
          );
        }
        try {
          await this.counts.notifyCounts(userId);
        } catch (err) {
          this.logger.warn(
            `notifyCounts failed for user ${userId}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }
}

