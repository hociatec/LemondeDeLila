import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import { AdminContactService } from '../../../application/services/admin-contact.service';
import { UserBadgeCountsService } from '../../../application/services/user-badge-counts.service';
import type { NotificationClientMeta } from './notification-ws.types';
import {
  notificationInboxActor,
  type NotificationInboxActor,
  type NotificationInboxResponseSender,
} from './notification-ws-inbox.contracts';
import { NotificationWsInboxThreadHandler } from './notification-ws-inbox-thread.handler';

const INBOX_EVENTS = new Set<string>([
  WS_EVENTS.notify.countsGet,
  WS_EVENTS.notify.inbox.list,
  WS_EVENTS.notify.inbox.delete,
  WS_EVENTS.notify.inbox.markRead,
  WS_EVENTS.notify.inbox.send,
  WS_EVENTS.notify.inbox.reply,
  WS_EVENTS.notify.inbox.setHandled,
  WS_EVENTS.notify.inbox.setStatus,
  WS_EVENTS.notify.inbox.cycleStatus,
  WS_EVENTS.notify.inbox.threads,
  WS_EVENTS.notify.inbox.deleteThread,
]);

@Injectable()
export class NotificationWsInboxHandler {
  private readonly logger = new Logger(NotificationWsInboxHandler.name);
  private readonly threads: NotificationWsInboxThreadHandler;

  constructor(
    private readonly adminContacts: AdminContactService,
    private readonly counts: UserBadgeCountsService,
  ) {
    this.threads = new NotificationWsInboxThreadHandler(adminContacts);
  }

  handles(type: string): boolean {
    return INBOX_EVENTS.has(type);
  }

  async handle(
    client: WebSocket,
    meta: NotificationClientMeta,
    type: string,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: NotificationInboxResponseSender,
  ): Promise<void> {
    if (this.threads.handles(type)) {
      return this.threads.handle(client, meta, type, payload, requestId, send);
    }
    if (type === WS_EVENTS.notify.countsGet)
      return this.handleCounts(client, meta, requestId, send);
    if (type === WS_EVENTS.notify.inbox.list)
      return this.handleList(client, meta, requestId, send);
    if (type === WS_EVENTS.notify.inbox.delete)
      return this.handleDelete(client, meta, payload, requestId, send);
    if (type === WS_EVENTS.notify.inbox.markRead)
      return this.handleMarkRead(client, meta, payload, requestId, send);
    if (type === WS_EVENTS.notify.inbox.send)
      return this.handleSend(client, meta, payload, requestId, send);
    await this.handleReply(client, meta, payload, requestId, send);
  }

  private async handleCounts(
    client: WebSocket,
    meta: NotificationClientMeta,
    requestId: string | null,
    send: NotificationInboxResponseSender,
  ): Promise<void> {
    this.logger.log(
      `notify.counts.get received user=${meta.userId} requestId=${requestId ?? 'none'}`,
    );
    try {
      send(
        client,
        WS_EVENTS.notify.counts,
        await this.counts.getCounts(meta.userId),
        requestId,
      );
    } catch {
      this.logger.warn(
        `notify.counts.get failed for user ${meta.userId}, returning zeros`,
      );
      send(
        client,
        WS_EVENTS.notify.counts,
        { unreadNotifications: 0, unreadMessages: 0 },
        requestId,
      );
    }
  }

  private async handleList(
    client: WebSocket,
    meta: NotificationClientMeta,
    requestId: string | null,
    send: NotificationInboxResponseSender,
  ): Promise<void> {
    try {
      const items = await this.adminContacts.listInbox(meta.userId, 200);
      send(client, WS_EVENTS.notify.inbox.snapshot, { items }, requestId);
    } catch {
      send(client, WS_EVENTS.notify.inbox.snapshot, { items: [] }, requestId);
    }
  }

  private async handleDelete(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: NotificationInboxResponseSender,
  ): Promise<void> {
    const id = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (!id) return;
    try {
      await this.adminContacts.deleteInboxItem(meta.userId, id);
      const items = await this.adminContacts.listInbox(meta.userId, 200);
      send(client, WS_EVENTS.notify.inbox.snapshot, { items }, requestId);
    } catch {
      // The inbox snapshot will reconcile the client on its next refresh.
    }
  }

  private async handleMarkRead(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: NotificationInboxResponseSender,
  ): Promise<void> {
    const id = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (!id) return;
    try {
      await this.adminContacts.markRead(meta.userId, id);
      send(client, WS_EVENTS.notify.inbox.markRead, { ok: true }, requestId);
    } catch {
      // Read acknowledgements are non-blocking for the realtime session.
    }
  }

  private async handleSend(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: NotificationInboxResponseSender,
  ): Promise<void> {
    try {
      const message =
        typeof payload.message === 'string' ? payload.message : '';
      const item = await this.adminContacts.sendFromUserToStaff(
        notificationInboxActor(meta),
        message,
      );
      send(
        client,
        WS_EVENTS.notify.inbox.sent,
        { id: item.id, contactId: item.contactId },
        requestId,
      );
    } catch (error) {
      sendInboxError(client, error, requestId, send);
    }
  }

  private async handleReply(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: NotificationInboxResponseSender,
  ): Promise<void> {
    try {
      const actor = notificationInboxActor(meta);
      const message =
        typeof payload.message === 'string' ? payload.message : '';
      const contactId =
        typeof payload.contactId === 'string' ? payload.contactId : '';
      const toUserId =
        typeof payload.toUserId === 'number' ? payload.toUserId : 0;
      const item = isStaff(actor)
        ? await this.adminContacts.replyFromStaffToUser(
            actor,
            toUserId,
            message,
            contactId,
          )
        : await this.adminContacts.sendFromUserToStaff(
            actor,
            message,
            contactId,
          );
      send(
        client,
        WS_EVENTS.notify.inbox.sent,
        { id: item.id, contactId: item.contactId },
        requestId,
      );
    } catch (error) {
      sendInboxError(client, error, requestId, send);
    }
  }
}

function isStaff(actor: NotificationInboxActor): boolean {
  return actor.roles.some((role) =>
    ['ROLE_ADMIN', 'admin', 'ROLE_MODERATOR', 'moderator'].includes(role),
  );
}

function sendInboxError(
  client: WebSocket,
  error: unknown,
  requestId: string | null,
  send: NotificationInboxResponseSender,
): void {
  const message =
    error instanceof Error && error.message ? error.message : 'Erreur';
  send(client, WS_EVENTS.notify.inbox.error, { message }, requestId);
}
