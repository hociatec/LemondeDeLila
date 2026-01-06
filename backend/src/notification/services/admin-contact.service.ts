import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import type { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { NotificationService } from './notification.service';
import { User } from '../../user/entities/user.entity';
import { NotificationInboxDbService } from './notification-inbox-db.service';
import { UserBadgeCountsService } from './user-badge-counts.service';

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
};

@Injectable()
export class AdminContactService {
  private readonly logger = new Logger(AdminContactService.name);

  constructor(
    private readonly notifications: NotificationService,
    private readonly inbox: NotificationInboxDbService,
    private readonly counts: UserBadgeCountsService,
    @InjectRepository(User) private readonly users: Repository<User>,
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

  async listInbox(userId: number, limit = 100): Promise<any[]> {
    const items = await this.inbox.list(userId, limit);
    return items.map((it) => ({
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
    }));
  }

  async deleteInboxItem(userId: number, id: string): Promise<void> {
    const ok = await this.inbox.delete(userId, id);
    this.logger.log(`Inbox delete user=${userId} id=${id} ok=${ok}`);
    const items = await this.inbox.list(userId, 5);
    const ids = items.map((it) => it.id).join(',');
    this.logger.log(`Inbox after delete user=${userId} remaining=${items.length} ids=[${ids}]`);
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
      throw new Error('Message vide.');
    }
    if (clean.length > 2000) {
      throw new Error('Message trop long (max 2000 caractères).');
    }

    const all = await this.users.find({ select: ['id', 'username', 'roles'] });
    const staffIds = all
      .filter((u) => this.isStaffRoles(u.roles))
      .map((u) => u.id)
      .filter((id) => typeof id === 'number' && id > 0);

    const cid = contactId || randomUUID();
    const createdAt = new Date();
    const baseItem: Omit<AdminContactItem, 'id'> = {
      kind: 'admin_contact',
      contactId: cid,
      createdAt: createdAt.toISOString(),
      message: clean,
      fromUserId: from.id,
      fromUsername: from.username,
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
          kind: 'admin_contact',
          createdAt,
          contactId: cid,
          fromUserId: from.id,
          fromUsername: from.username,
          toUserId: null,
          message: clean,
          payload: null,
        });
        try {
          await this.notifications.notifyUser(uid, 'notify.inbox.item', item);
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
      throw new Error('Accès refusé.');
    }
    if (!toUserId || toUserId <= 0) {
      throw new Error('Destinataire invalide.');
    }
    const clean = String(message || '').trim();
    if (!clean) {
      throw new Error('Message vide.');
    }
    if (clean.length > 2000) {
      throw new Error('Message trop long (max 2000 caractères).');
    }
    const cid = String(contactId || '').trim();
    if (!cid) {
      throw new Error('contactId requis.');
    }

    const all = await this.users.find({ select: ['id', 'username', 'roles'] });
    const staffIds = all
      .filter((u) => this.isStaffRoles(u.roles))
      .map((u) => u.id)
      .filter((id) => typeof id === 'number' && id > 0);

    const createdAt = new Date();
    const baseItem: Omit<AdminContactItem, 'id'> = {
      kind: 'admin_contact',
      contactId: cid,
      createdAt: createdAt.toISOString(),
      message: clean,
      fromUserId: from.id,
      fromUsername: from.username,
      toUserId,
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
          kind: 'admin_contact',
          createdAt,
          contactId: cid,
          fromUserId: from.id,
          fromUsername: from.username,
          toUserId,
          message: clean,
          payload: null,
        });
        try {
          await this.notifications.notifyUser(uid, 'notify.inbox.item', item);
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
}
