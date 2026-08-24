import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { ClientUpdatesService } from '../../../../client-updates/public-api';
import {
  isVersionGreater,
  isVersionLower,
} from '../../../../common/utils/public-api';
import { AdminContactService } from '../../../application/services/admin-contact.service';
import { UserBadgeCountsService } from '../../../application/services/user-badge-counts.service';
import { NotificationIdentifierRequiredError } from '../../../domain/errors/notification-domain.errors';
import type { NotificationClientMeta } from './notification-ws.types';

type NotificationInboxActor = {
  id: number;
  username: string;
  roles: string[];
};

@Injectable()
export class NotificationWsHandler {
  private readonly logger = new Logger(NotificationWsHandler.name);

  constructor(
    private readonly adminContacts: AdminContactService,
    private readonly counts: UserBadgeCountsService,
    private readonly clientUpdates: ClientUpdatesService,
  ) {}

  async handle(
    client: WebSocket,
    meta: NotificationClientMeta,
    parsed: Record<string, unknown>,
    requestId: string | null,
  ): Promise<void> {
    const type = typeof parsed.type === 'string' ? parsed.type : '';
    const payload =
      parsed.payload && typeof parsed.payload === 'object'
        ? (parsed.payload as Record<string, unknown>)
        : {};
    if (!type) {
      return;
    }

    if (type === WS_EVENTS.notify.countsGet) {
      this.logger.log(
        `notify.counts.get received user=${meta.userId} requestId=${requestId ?? 'none'}`,
      );
      try {
        const payload = await this.counts.getCounts(meta.userId);
        this.logger.log(
          `notify.counts.get for user ${meta.userId}: ${JSON.stringify(payload)}`,
        );
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.counts,
          payload,
          requestId,
        );
      } catch {
        this.logger.warn(
          `notify.counts.get failed for user ${meta.userId}, returning zeros`,
        );
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.counts,
          { unreadNotifications: 0, unreadMessages: 0 },
          requestId,
        );
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.list) {
      try {
        const items = await this.adminContacts.listInbox(meta.userId, 200);
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.snapshot,
          { items },
          requestId,
        );
      } catch {
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.snapshot,
          { items: [] },
          requestId,
        );
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.delete) {
      const id = typeof payload.id === 'string' ? payload.id.trim() : '';
      if (!id) {
        return;
      }
      try {
        this.logger.log(`notify.inbox.delete user=${meta.userId} id=${id}`);
        await this.adminContacts.deleteInboxItem(meta.userId, id);
        const items = await this.adminContacts.listInbox(meta.userId, 200);
        const sampleIds = items
          .slice(0, 5)
          .map((item) => item.id)
          .join(',');
        this.logger.log(
          `notify.inbox.snapshot after delete user=${meta.userId} count=${items.length} ids=[${sampleIds}]`,
        );
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.snapshot,
          { items },
          requestId,
        );
      } catch {
        // ignore
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.markRead) {
      const id = typeof payload.id === 'string' ? payload.id.trim() : '';
      if (!id) {
        return;
      }
      try {
        await this.adminContacts.markRead(meta.userId, id);
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.markRead,
          { ok: true },
          requestId,
        );
      } catch {
        // ignore
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.send) {
      try {
        const message =
          typeof payload.message === 'string' ? payload.message : '';
        const item = await this.adminContacts.sendFromUserToStaff(
          this.toInboxActor(meta),
          message,
        );
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.sent,
          { id: item.id, contactId: item.contactId },
          requestId,
        );
      } catch (err: unknown) {
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.error,
          { message: this.toErrorMessage(err) },
          requestId,
        );
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.reply) {
      try {
        const from = this.toInboxActor(meta);
        const message =
          typeof payload.message === 'string' ? payload.message : '';
        const contactId =
          typeof payload.contactId === 'string' ? payload.contactId : '';
        const toUserId =
          typeof payload.toUserId === 'number' ? payload.toUserId : 0;
        const isStaff =
          Array.isArray(from.roles) &&
          (from.roles.includes('ROLE_ADMIN') ||
            from.roles.includes('admin') ||
            from.roles.includes('ROLE_MODERATOR') ||
            from.roles.includes('moderator'));
        const item = isStaff
          ? await this.adminContacts.replyFromStaffToUser(
              from,
              toUserId,
              message,
              contactId,
            )
          : await this.adminContacts.sendFromUserToStaff(
              from,
              message,
              contactId,
            );
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.sent,
          { id: item.id, contactId: item.contactId },
          requestId,
        );
      } catch (err: unknown) {
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.error,
          { message: this.toErrorMessage(err) },
          requestId,
        );
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.setHandled) {
      try {
        const contactId =
          typeof payload.contactId === 'string' ? payload.contactId : '';
        const handled = Boolean(payload.handled);
        await this.adminContacts.setHandledForContact(
          this.toInboxActor(meta),
          contactId,
          handled,
        );
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.setHandled,
          { ok: true },
          requestId,
        );
      } catch (err: unknown) {
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.error,
          { message: this.toErrorMessage(err) },
          requestId,
        );
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.setStatus) {
      try {
        const contactId =
          typeof payload.contactId === 'string' ? payload.contactId : '';
        const inboxItemId = typeof payload.id === 'string' ? payload.id : '';
        const status = typeof payload.status === 'string' ? payload.status : '';
        const from = this.toInboxActor(meta);
        if (contactId) {
          await this.adminContacts.setStatusForContact(from, contactId, status);
        } else if (inboxItemId) {
          await this.adminContacts.setStatusForInboxItem(
            from,
            meta.userId,
            inboxItemId,
            status,
          );
        } else {
          throw new NotificationIdentifierRequiredError();
        }
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.setStatus,
          { ok: true },
          requestId,
        );
      } catch (err: unknown) {
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.error,
          { message: this.toErrorMessage(err) },
          requestId,
        );
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.cycleStatus) {
      try {
        const contactId =
          typeof payload.contactId === 'string' ? payload.contactId : '';
        const inboxItemId = typeof payload.id === 'string' ? payload.id : '';
        const from = this.toInboxActor(meta);
        const result = contactId
          ? await this.adminContacts.cycleStatusForContact(from, contactId)
          : inboxItemId
            ? await this.adminContacts.cycleStatusForInboxItem(
                from,
                meta.userId,
                inboxItemId,
              )
            : (() => {
                throw new NotificationIdentifierRequiredError();
              })();
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.cycleStatus,
          { ok: true, status: result.status },
          requestId,
        );
      } catch (err: unknown) {
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.error,
          { message: this.toErrorMessage(err) },
          requestId,
        );
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.threads) {
      try {
        const limitThreads =
          typeof payload.limit === 'number' ? payload.limit : undefined;
        const threads = await this.adminContacts.listThreads(meta.userId, {
          limitThreads,
        });
        const sections = {
          open: threads.filter((thread) => thread.status === 'open'),
          in_progress: threads.filter(
            (thread) => thread.status === 'in_progress',
          ),
          handled: threads.filter((thread) => thread.status === 'handled'),
        };
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.threads,
          {
            sections: [
              {
                id: 'open',
                title: 'Ouvert',
                collapsed: true,
                items: sections.open,
              },
              {
                id: 'in_progress',
                title: 'En cours',
                collapsed: true,
                items: sections.in_progress,
              },
              {
                id: 'handled',
                title: 'Traité',
                collapsed: true,
                items: sections.handled,
              },
            ],
            total: threads.length,
          },
          requestId,
        );
      } catch (err: unknown) {
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.error,
          { message: this.toErrorMessage(err) },
          requestId,
        );
      }
      return;
    }

    if (type === WS_EVENTS.notify.inbox.deleteThread) {
      try {
        const contactId =
          typeof payload.contactId === 'string' ? payload.contactId : '';
        await this.adminContacts.deleteThreadForContact(
          this.toInboxActor(meta),
          contactId,
        );
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.deleteThread,
          { ok: true },
          requestId,
        );
      } catch (err: unknown) {
        this.safeSendResponse(
          client,
          WS_EVENTS.notify.inbox.error,
          { message: this.toErrorMessage(err) },
          requestId,
        );
      }
      return;
    }

    if (type !== 'client.hello') {
      return;
    }

    const version =
      typeof payload.version === 'string' ? payload.version.trim() : '';
    if (!version) {
      return;
    }

    try {
      const latest = await this.clientUpdates.getLatest();
      const latestVersion = latest?.version?.trim();
      const minRequiredVersion =
        (await this.clientUpdates.getMinRequiredVersion())?.trim() || null;
      const url = this.clientUpdates.resolveClientPublicUrlForOrigin(
        latest,
        meta.origin,
      );

      if (minRequiredVersion) {
        const required = isVersionLower(version, minRequiredVersion);
        if (required === true) {
          this.safeSend(client, {
            type: WS_EVENTS.clientUpdate.required,
            payload: {
              minRequiredVersion,
              currentVersion: version,
              message:
                latest?.message ??
                'Une mise à jour du client est requise pour continuer.',
              publishedAt: latest?.publishedAt ?? null,
              url,
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 300));
          try {
            client.close(4406, 'update required');
          } catch {
            /* ignore */
          }
          return;
        }
      }

      if (latestVersion) {
        const available = isVersionGreater(latestVersion, version);
        if (available === true) {
          this.safeSend(client, {
            type: WS_EVENTS.clientUpdate.available,
            payload: {
              version: latestVersion,
              message: latest?.message ?? null,
              publishedAt: latest?.publishedAt ?? null,
              url,
            },
          });
        }
      }
    } catch (err) {
      this.logger.debug('Echec vérification version client', err as Error);
    }
  }

  private safeSend(client: WebSocket, payload: unknown) {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      const record = payload as Record<string, unknown> | null;
      const type =
        record && typeof record.type === 'string' ? record.type : 'unknown';
      this.logger.warn(
        `Echec envoi WS notify (type=${type}) : ${(err as Error).message}`,
      );
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private safeSendResponse(
    client: WebSocket,
    type: string,
    payload: unknown,
    requestId: string | null,
  ) {
    this.safeSend(
      client,
      requestId ? { type, payload, requestId } : { type, payload },
    );
  }

  private toInboxActor(meta: NotificationClientMeta): NotificationInboxActor {
    return {
      id: meta.userId,
      username: meta.username,
      roles: meta.roles,
    };
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Erreur';
  }
}
