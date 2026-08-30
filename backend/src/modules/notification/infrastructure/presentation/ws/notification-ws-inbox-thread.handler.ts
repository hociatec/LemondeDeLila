import type { WebSocket } from 'ws';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import { AdminContactService } from '../../../application/services/admin-contact.service';
import { NotificationIdentifierRequiredError } from '../../../domain/errors/notification-domain.errors';
import type { NotificationClientMeta } from './notification-ws.types';
import {
  inboxString,
  notificationInboxActor,
  type NotificationInboxResponseSender,
} from './notification-ws-inbox.contracts';

const THREAD_EVENTS = new Set<string>([
  WS_EVENTS.notify.inbox.setHandled,
  WS_EVENTS.notify.inbox.setStatus,
  WS_EVENTS.notify.inbox.cycleStatus,
  WS_EVENTS.notify.inbox.threads,
  WS_EVENTS.notify.inbox.deleteThread,
]);

/** Staff thread workflow, separated from personal inbox commands. */
export class NotificationWsInboxThreadHandler {
  constructor(private readonly contacts: AdminContactService) {}

  handles(type: string): boolean {
    return THREAD_EVENTS.has(type);
  }

  async handle(
    client: WebSocket,
    meta: NotificationClientMeta,
    type: string,
    payload: Record<string, unknown>,
    requestId: string | null,
    send: NotificationInboxResponseSender,
  ): Promise<void> {
    try {
      const result = await this.execute(meta, type, payload);
      send(client, type, result, requestId);
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'Erreur';
      send(client, WS_EVENTS.notify.inbox.error, { message }, requestId);
    }
  }

  private async execute(
    meta: NotificationClientMeta,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const actor = notificationInboxActor(meta);
    const contactId = inboxString(payload.contactId);
    if (type === WS_EVENTS.notify.inbox.setHandled) {
      await this.contacts.setHandledForContact(
        actor,
        contactId,
        Boolean(payload.handled),
      );
      return { ok: true };
    }
    if (type === WS_EVENTS.notify.inbox.setStatus) {
      const itemId = inboxString(payload.id);
      if (contactId)
        await this.contacts.setStatusForContact(
          actor,
          contactId,
          inboxString(payload.status),
        );
      else if (itemId)
        await this.contacts.setStatusForInboxItem(
          actor,
          meta.userId,
          itemId,
          inboxString(payload.status),
        );
      else throw new NotificationIdentifierRequiredError();
      return { ok: true };
    }
    if (type === WS_EVENTS.notify.inbox.cycleStatus) {
      const itemId = inboxString(payload.id);
      const result = contactId
        ? await this.contacts.cycleStatusForContact(actor, contactId)
        : itemId
          ? await this.contacts.cycleStatusForInboxItem(
              actor,
              meta.userId,
              itemId,
            )
          : null;
      if (!result) throw new NotificationIdentifierRequiredError();
      return { ok: true, status: result.status };
    }
    if (type === WS_EVENTS.notify.inbox.deleteThread) {
      await this.contacts.deleteThreadForContact(actor, contactId);
      return { ok: true };
    }
    const limitThreads =
      typeof payload.limit === 'number' ? payload.limit : undefined;
    const threads = await this.contacts.listThreads(meta.userId, {
      limitThreads,
    });
    const definitions = [
      { id: 'open', title: 'Ouvert' },
      { id: 'in_progress', title: 'En cours' },
      { id: 'handled', title: 'Traité' },
    ] as const;
    return {
      sections: definitions.map((definition) => ({
        ...definition,
        collapsed: true,
        items: threads.filter((thread) => thread.status === definition.id),
      })),
      total: threads.length,
    };
  }
}
