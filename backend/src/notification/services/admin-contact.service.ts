import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import type { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { NotificationService } from './notification.service';
import { User } from '../../user/entities/user.entity';
import { InboxNotificationItem, UserInboxService } from './user-inbox.service';

export type AdminContactItem = InboxNotificationItem & {
  kind: 'admin_contact';
  contactId: string;
  message: string;
  fromUserId: number;
  fromUsername: string;
  // When staff replies, the target user id is included.
  toUserId?: number;
};

@Injectable()
export class AdminContactService {
  constructor(
    private readonly notifications: NotificationService,
    private readonly inbox: UserInboxService,
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

  async listInbox(userId: number, limit = 100): Promise<InboxNotificationItem[]> {
    return this.inbox.list(userId, limit);
  }

  async deleteInboxItem(userId: number, id: string): Promise<void> {
    await this.inbox.delete(userId, id);
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

    const item: AdminContactItem = {
      id: randomUUID(),
      kind: 'admin_contact',
      contactId: contactId || randomUUID(),
      createdAt: new Date().toISOString(),
      message: clean,
      fromUserId: from.id,
      fromUsername: from.username,
    };

    const recipients = new Set<number>([from.id, ...staffIds]);

    await Promise.all(
      Array.from(recipients).map(async (uid) => {
        await this.inbox.add(uid, item);
        await this.notifications.notifyUser(uid, 'notify.inbox.item', item);
      }),
    );

    return item;
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

    const item: AdminContactItem = {
      id: randomUUID(),
      kind: 'admin_contact',
      contactId: cid,
      createdAt: new Date().toISOString(),
      message: clean,
      fromUserId: from.id,
      fromUsername: from.username,
      toUserId,
    };

    const recipients = new Set<number>([toUserId, ...staffIds]);

    await Promise.all(
      Array.from(recipients).map(async (uid) => {
        await this.inbox.add(uid, item);
        await this.notifications.notifyUser(uid, 'notify.inbox.item', item);
      }),
    );

    return item;
  }
}

