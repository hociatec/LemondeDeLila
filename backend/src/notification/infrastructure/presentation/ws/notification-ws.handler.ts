import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { UpdatePolicyService } from '../../../../update/public-api';
import type { NotificationClientMeta } from './notification-ws.types';
import { NotificationWsInboxHandler } from './notification-ws-inbox.handler';

@Injectable()
export class NotificationWsHandler {
  private readonly logger = new Logger(NotificationWsHandler.name);

  constructor(
    private readonly inbox: NotificationWsInboxHandler,
    private readonly updates: UpdatePolicyService,
  ) {}

  async handle(
    client: WebSocket,
    meta: NotificationClientMeta,
    parsed: Record<string, unknown>,
    requestId: string | null,
  ): Promise<void> {
    const type = typeof parsed.type === 'string' ? parsed.type : '';
    if (!type) return;
    const payload = this.readPayload(parsed.payload);
    if (this.inbox.handles(type)) {
      await this.inbox.handle(
        client,
        meta,
        type,
        payload,
        requestId,
        this.safeSendResponse.bind(this),
      );
      return;
    }
    if (type === 'client.hello') {
      await this.handleClientHello(client, meta, payload);
    }
  }

  private async handleClientHello(
    client: WebSocket,
    meta: NotificationClientMeta,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const version =
      typeof payload.version === 'string' ? payload.version.trim() : '';
    if (!version) return;
    try {
      const notice = await this.updates.getNotice(
        meta.product,
        version,
        meta.origin,
      );
      if (notice.updateRequired && notice.minimumVersion) {
        this.sendRequiredUpdate(client, version, notice);
        await new Promise((resolve) => setTimeout(resolve, 300));
        try {
          client.close(4406, 'update required');
        } catch {
          // The socket may already be closed by the client.
        }
        return;
      }
      if (notice.latestVersion && notice.updateAvailable === true) {
        this.safeSend(client, {
          type: WS_EVENTS.clientUpdate.available,
          payload: {
            version: notice.latestVersion,
            message: notice.message,
            publishedAt: notice.publishedAt,
            url: notice.url,
          },
        });
      }
    } catch (error) {
      this.logger.debug('Echec vérification version client', error as Error);
    }
  }

  private sendRequiredUpdate(
    client: WebSocket,
    currentVersion: string,
    notice: Awaited<ReturnType<UpdatePolicyService['getNotice']>>,
  ): void {
    this.safeSend(client, {
      type: WS_EVENTS.clientUpdate.required,
      payload: {
        minRequiredVersion: notice.minimumVersion,
        currentVersion,
        message:
          notice.message ??
          'Une mise à jour du client est requise pour continuer.',
        publishedAt: notice.publishedAt,
        url: notice.url,
      },
    });
  }

  private safeSend(client: WebSocket, payload: unknown): void {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch (error) {
      const record = payload as Record<string, unknown> | null;
      const type =
        record && typeof record.type === 'string' ? record.type : 'unknown';
      this.logger.warn(
        `Echec envoi WS notify (type=${type}) : ${(error as Error).message}`,
      );
      try {
        client.close();
      } catch {
        // The socket may already be closed by the client.
      }
    }
  }

  private safeSendResponse(
    client: WebSocket,
    type: string,
    payload: unknown,
    requestId: string | null,
  ): void {
    this.safeSend(
      client,
      requestId ? { type, payload, requestId } : { type, payload },
    );
  }

  private readPayload(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}
