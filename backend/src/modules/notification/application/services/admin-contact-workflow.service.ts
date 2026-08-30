import { Inject, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '@shared/utils/public-api';
import type { WsAuthPayload } from '../../../../shared/interfaces/public-api';
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
  NotificationAccessDeniedError,
  NotificationContactIdRequiredError,
  NotificationContactNotFoundError,
} from '../../domain/errors/notification-domain.errors';
import type {
  AdminContactItem,
  AdminContactStatus,
} from '../contracts/admin-contact.model';
import {
  ADMIN_CONTACT_KIND,
  normalizeAdminContactPayload,
  normalizeAdminContactStatus,
} from './admin-contact-normalization';

type StaffIdentity = Pick<WsAuthPayload, 'id' | 'username' | 'roles'>;

@Injectable()
export class AdminContactWorkflowService {
  private readonly logger = new Logger(AdminContactWorkflowService.name);

  constructor(
    @Inject(NOTIFICATION_INBOX_REPOSITORY)
    private readonly inbox: NotificationInboxRepository,
    @Inject(NOTIFICATION_INBOX_NOTIFIER)
    private readonly notifier: NotificationInboxNotifier,
    @Inject(USER_BADGE_COUNTS_NOTIFIER)
    private readonly counts: UserBadgeCountsNotifier,
  ) {}

  async cycleForContact(
    from: StaffIdentity,
    contactId: string,
  ): Promise<{ status: AdminContactStatus }> {
    this.assertStaff(from.roles);
    const cid = this.contactId(contactId);
    const rows = await this.inbox.listByContactId(ADMIN_CONTACT_KIND, cid);
    if (rows.length === 0) return { status: 'open' };
    const current = normalizeAdminContactPayload(rows[0].payload).status;
    const next =
      current === 'open'
        ? 'in_progress'
        : current === 'in_progress'
          ? 'handled'
          : 'open';
    await this.setForContact(from, cid, next);
    return { status: next };
  }

  async cycleForInboxItem(
    from: StaffIdentity,
    userId: number,
    inboxItemId: string,
  ): Promise<{ status: AdminContactStatus }> {
    return this.cycleForContact(
      from,
      await this.contactIdForInboxItem(userId, inboxItemId),
    );
  }

  async setForInboxItem(
    from: StaffIdentity,
    userId: number,
    inboxItemId: string,
    status: unknown,
  ): Promise<void> {
    await this.setForContact(
      from,
      await this.contactIdForInboxItem(userId, inboxItemId),
      status,
    );
  }

  async setForContact(
    from: StaffIdentity,
    contactId: string,
    status: unknown,
  ): Promise<void> {
    this.assertStaff(from.roles);
    const cid = this.contactId(contactId);
    const normalizedStatus = normalizeAdminContactStatus(status);
    const rows = await this.inbox.listByContactId(ADMIN_CONTACT_KIND, cid);
    if (rows.length === 0) return;
    const now = new Date().toISOString();
    const handled = normalizedStatus === 'handled';
    await Promise.all(
      rows.map(async (row) => {
        const payload = {
          ...(row.payload ?? {}),
          status: normalizedStatus,
          handled,
          statusAt: now,
          statusByUserId: from.id,
          statusByUsername: from.username,
          handledAt: handled ? now : null,
          handledByUserId: handled ? from.id : null,
          handledByUsername: handled ? from.username : null,
        };
        await this.inbox.updatePayload(row.id, payload);
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
          ...payload,
        };
        try {
          await this.notifier.notifyInboxItem(row.userId, item);
        } catch (error) {
          this.logger.warn(
            `notify.inbox.item failed for user ${row.userId}: ${getErrorMessage(error)}`,
          );
        }
      }),
    );
  }

  async deleteThread(from: StaffIdentity, contactId: string): Promise<void> {
    this.assertStaff(from.roles);
    const cid = this.contactId(contactId);
    const rows = await this.inbox.listByContactId(ADMIN_CONTACT_KIND, cid);
    if (rows.length === 0) return;
    const byUser = new Map<number, string[]>();
    for (const row of rows) {
      const ids = byUser.get(row.userId) ?? [];
      ids.push(row.id);
      byUser.set(row.userId, ids);
    }
    await this.inbox.deleteManyByIds(rows.map((row) => row.id));
    await Promise.all(
      [...byUser].map(async ([userId, ids]) => {
        await this.bestEffort(
          () =>
            this.notifier.notifyInboxRemoved(userId, { ids, contactId: cid }),
          `notify.inbox.removed failed for user ${userId}`,
        );
        await this.bestEffort(
          () => this.counts.notifyCounts(userId),
          `notifyCounts failed for user ${userId}`,
        );
      }),
    );
  }

  private async contactIdForInboxItem(
    userId: number,
    inboxItemId: string,
  ): Promise<string> {
    const item = await this.inbox.getByIdForUser(userId, inboxItemId);
    const contactId =
      item?.kind === ADMIN_CONTACT_KIND ? (item.contactId ?? '') : '';
    if (!contactId) throw new NotificationContactNotFoundError();
    return contactId;
  }

  private contactId(value: string): string {
    const contactId = String(value || '').trim();
    if (!contactId) throw new NotificationContactIdRequiredError();
    return contactId;
  }

  private assertStaff(roles: unknown): void {
    const values = Array.isArray(roles) ? roles.map(String) : [];
    if (
      !values.some((role) =>
        ['ROLE_ADMIN', 'admin', 'ROLE_MODERATOR', 'moderator'].includes(role),
      )
    ) {
      throw new NotificationAccessDeniedError();
    }
  }

  private async bestEffort(
    operation: () => Promise<void>,
    message: string,
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logger.warn(`${message}: ${getErrorMessage(error)}`);
    }
  }
}
