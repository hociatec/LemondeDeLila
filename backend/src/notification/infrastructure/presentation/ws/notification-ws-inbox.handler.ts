import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { AdminContactService } from '../../../application/services/admin-contact.service';
import { UserBadgeCountsService } from '../../../application/services/user-badge-counts.service';
import { NotificationIdentifierRequiredError } from '../../../domain/errors/notification-domain.errors';
import type { NotificationClientMeta } from './notification-ws.types';

type ResponseSender = (
  client: WebSocket,
  type: string,
  payload: unknown,
  requestId: string | null,
) => void;

type NotificationInboxActor = {
  id: number;
  username: string;
  roles: string[];
};

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

  constructor(
    private readonly adminContacts: AdminContactService,
    private readonly counts: UserBadgeCountsService,
  ) {}

  handles(type: string): boolean {
    return INBOX_EVENTS.has(type);
  }

  async handle(
    client: WebSocket,
    meta: NotificationClientMeta,
    type: string,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    if (type === WS_EVENTS.notify.countsGet) {
      return this.handleCounts(client, meta, requestId, send);
    }
    if (type === WS_EVENTS.notify.inbox.list) {
      return this.handleList(client, meta, requestId, send);
    }
    if (type === WS_EVENTS.notify.inbox.delete) {
      return this.handleDelete(client, meta, payload, requestId, send);
    }
    if (type === WS_EVENTS.notify.inbox.markRead) {
      return this.handleMarkRead(client, meta, payload, requestId, send);
    }
    if (type === WS_EVENTS.notify.inbox.send) {
      return this.handleSend(client, meta, payload, requestId, send);
    }
    if (type === WS_EVENTS.notify.inbox.reply) {
      return this.handleReply(client, meta, payload, requestId, send);
    }
    if (type === WS_EVENTS.notify.inbox.setHandled) {
      return this.handleSetHandled(client, meta, payload, requestId, send);
    }
    if (type === WS_EVENTS.notify.inbox.setStatus) {
      return this.handleSetStatus(client, meta, payload, requestId, send);
    }
    if (type === WS_EVENTS.notify.inbox.cycleStatus) {
      return this.handleCycleStatus(client, meta, payload, requestId, send);
    }
    if (type === WS_EVENTS.notify.inbox.threads) {
      return this.handleThreads(client, meta, payload, requestId, send);
    }
    await this.handleDeleteThread(client, meta, payload, requestId, send);
  }

  private async handleCounts(
    client: WebSocket,
    meta: NotificationClientMeta,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    this.logger.log(
      `notify.counts.get received user=${meta.userId} requestId=${requestId ?? 'none'}`,
    );
    try {
      const counts = await this.counts.getCounts(meta.userId);
      send(client, WS_EVENTS.notify.counts, counts, requestId);
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
    send: ResponseSender,
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
    send: ResponseSender,
  ): Promise<void> {
    const id = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (!id) return;
    try {
      await this.adminContacts.deleteInboxItem(meta.userId, id);
      const items = await this.adminContacts.listInbox(meta.userId, 200);
      send(client, WS_EVENTS.notify.inbox.snapshot, { items }, requestId);
    } catch {
      // The legacy contract treats inbox deletion as best effort.
    }
  }

  private async handleMarkRead(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    const id = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (!id) return;
    try {
      await this.adminContacts.markRead(meta.userId, id);
      send(client, WS_EVENTS.notify.inbox.markRead, { ok: true }, requestId);
    } catch {
      // The legacy contract treats read acknowledgements as best effort.
    }
  }

  private async handleSend(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    try {
      const message =
        typeof payload.message === 'string' ? payload.message : '';
      const item = await this.adminContacts.sendFromUserToStaff(
        this.toActor(meta),
        message,
      );
      send(
        client,
        WS_EVENTS.notify.inbox.sent,
        { id: item.id, contactId: item.contactId },
        requestId,
      );
    } catch (error) {
      this.sendError(client, error, requestId, send);
    }
  }

  private async handleReply(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    try {
      const actor = this.toActor(meta);
      const message =
        typeof payload.message === 'string' ? payload.message : '';
      const contactId =
        typeof payload.contactId === 'string' ? payload.contactId : '';
      const toUserId =
        typeof payload.toUserId === 'number' ? payload.toUserId : 0;
      const item = this.isStaff(actor)
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
      this.sendError(client, error, requestId, send);
    }
  }

  private async handleSetHandled(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    try {
      const contactId =
        typeof payload.contactId === 'string' ? payload.contactId : '';
      await this.adminContacts.setHandledForContact(
        this.toActor(meta),
        contactId,
        Boolean(payload.handled),
      );
      send(client, WS_EVENTS.notify.inbox.setHandled, { ok: true }, requestId);
    } catch (error) {
      this.sendError(client, error, requestId, send);
    }
  }

  private async handleSetStatus(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    try {
      const contactId = this.readString(payload.contactId);
      const inboxItemId = this.readString(payload.id);
      const status = this.readString(payload.status);
      const actor = this.toActor(meta);
      if (contactId) {
        await this.adminContacts.setStatusForContact(actor, contactId, status);
      } else if (inboxItemId) {
        await this.adminContacts.setStatusForInboxItem(
          actor,
          meta.userId,
          inboxItemId,
          status,
        );
      } else {
        throw new NotificationIdentifierRequiredError();
      }
      send(client, WS_EVENTS.notify.inbox.setStatus, { ok: true }, requestId);
    } catch (error) {
      this.sendError(client, error, requestId, send);
    }
  }

  private async handleCycleStatus(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    try {
      const contactId = this.readString(payload.contactId);
      const inboxItemId = this.readString(payload.id);
      const actor = this.toActor(meta);
      const result = contactId
        ? await this.adminContacts.cycleStatusForContact(actor, contactId)
        : inboxItemId
          ? await this.adminContacts.cycleStatusForInboxItem(
              actor,
              meta.userId,
              inboxItemId,
            )
          : null;
      if (!result) throw new NotificationIdentifierRequiredError();
      send(
        client,
        WS_EVENTS.notify.inbox.cycleStatus,
        { ok: true, status: result.status },
        requestId,
      );
    } catch (error) {
      this.sendError(client, error, requestId, send);
    }
  }

  private async handleThreads(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    try {
      const limitThreads =
        typeof payload.limit === 'number' ? payload.limit : undefined;
      const threads = await this.adminContacts.listThreads(meta.userId, {
        limitThreads,
      });
      const definitions = [
        { id: 'open', title: 'Ouvert' },
        { id: 'in_progress', title: 'En cours' },
        { id: 'handled', title: 'Traité' },
      ] as const;
      const sections = definitions.map((definition) => ({
        ...definition,
        collapsed: true,
        items: threads.filter((thread) => thread.status === definition.id),
      }));
      send(
        client,
        WS_EVENTS.notify.inbox.threads,
        { sections, total: threads.length },
        requestId,
      );
    } catch (error) {
      this.sendError(client, error, requestId, send);
    }
  }

  private async handleDeleteThread(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: ResponseSender,
  ): Promise<void> {
    try {
      await this.adminContacts.deleteThreadForContact(
        this.toActor(meta),
        this.readString(payload.contactId),
      );
      send(
        client,
        WS_EVENTS.notify.inbox.deleteThread,
        { ok: true },
        requestId,
      );
    } catch (error) {
      this.sendError(client, error, requestId, send);
    }
  }

  private sendError(
    client: WebSocket,
    error: unknown,
    requestId: string | null,
    send: ResponseSender,
  ): void {
    const message =
      error instanceof Error && error.message ? error.message : 'Erreur';
    send(client, WS_EVENTS.notify.inbox.error, { message }, requestId);
  }

  private toActor(meta: NotificationClientMeta): NotificationInboxActor {
    return { id: meta.userId, username: meta.username, roles: meta.roles };
  }

  private isStaff(actor: NotificationInboxActor): boolean {
    return actor.roles.some((role) =>
      ['ROLE_ADMIN', 'admin', 'ROLE_MODERATOR', 'moderator'].includes(role),
    );
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
