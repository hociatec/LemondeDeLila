import { Inject, Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { UpdatePolicyService } from '../../../../update/public-api';
import {
  SESSION_STORE,
  type SessionStateStore,
} from '../../../../common/session/public-api';
import { isVersionLower } from '../../../../common/utils/public-api';
import { WsRouteRegistry } from '../../../../common/ws/public-api';
import type {
  RealtimeClientSession,
  RealtimeIncomingMessage,
} from './realtime-api.types';

@Injectable()
export class RealtimeApiHandlerService {
  private readonly logger = new Logger(RealtimeApiHandlerService.name);

  constructor(
    private readonly registry: WsRouteRegistry,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStateStore,
    private readonly updates: UpdatePolicyService,
  ) {}

  async persistSession(session: RealtimeClientSession): Promise<void> {
    try {
      await this.sessionStore.save(session.connectionId, {
        userId: session.user?.id ?? null,
        username: session.user?.username,
        roles: session.user?.roles ?? null,
      });
    } catch (err) {
      this.logger.warn(
        `Impossible de persister la session WS (connectionId=${session.connectionId}): ${(err as Error).message}`,
      );
    }
  }

  async clearSession(connectionId: string): Promise<void> {
    await this.sessionStore.delete(connectionId).catch(() => {});
  }

  async handleIncoming(
    client: WebSocket,
    session: RealtimeClientSession,
    raw: unknown,
  ): Promise<void> {
    const decoded = this.decode(raw);
    if (!decoded?.type) {
      this.logger.debug(
        `Message WS ignoré (invalide ou sans type) connectionId=${session.connectionId}`,
      );
      return;
    }

    const { type, payload, requestId } = decoded;
    const minRequired = await this.updates.getMinimumVersion(
      session.clientProduct,
    );
    if (
      minRequired &&
      (!session.clientVersion ||
        isVersionLower(session.clientVersion, minRequired) === true)
    ) {
      this.sendError(
        client,
        `Mise à jour requise (version minimale: ${minRequired}).`,
        type,
        requestId,
      );
      try {
        client.close(4406, 'update required');
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      if (type === 'r' || type === 'R') {
        return;
      }

      const handler = this.registry.get(type);
      if (!handler) {
        this.logger.warn(
          `Type WS inconnu: ${type} (requestId=${requestId ?? 'n/a'})`,
        );
        this.sendError(client, 'Type de message inconnu', type, requestId);
        return;
      }

      const start = Date.now();
      this.logger.debug(
        `WS -> backend type=${type} requestId=${requestId ?? 'n/a'} userId=${session.user?.id ?? 'anon'} connectionId=${session.connectionId}`,
      );
      const response = await handler(session, payload);
      const elapsedMs = Date.now() - start;
      if (elapsedMs >= 2000) {
        this.logger.warn(
          `WS handler lent: ${type} (${elapsedMs}ms) requestId=${requestId ?? 'n/a'}`,
        );
      } else {
        this.logger.debug(
          `WS handler ok: ${type} (${elapsedMs}ms) requestId=${requestId ?? 'n/a'}`,
        );
      }
      if (response) {
        for (const item of Array.isArray(response) ? response : [response]) {
          this.safeSend(client, { requestId, ...item });
        }
      }
    } catch (err) {
      this.logger.error(
        `Erreur handler WS type=${type} requestId=${requestId ?? 'n/a'} userId=${session.user?.id ?? 'anon'} connectionId=${session.connectionId}: ${this.formatError(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      this.sendError(client, this.formatError(err), type, requestId);
    }
  }

  private decode(raw: unknown): RealtimeIncomingMessage | null {
    let text = '';
    if (typeof raw === 'string') {
      text = raw;
    } else if (Buffer.isBuffer(raw)) {
      text = raw.toString('utf-8');
    } else if (raw && typeof raw === 'object' && 'byteLength' in raw) {
      text = Buffer.from(raw as ArrayBuffer).toString('utf-8');
    } else {
      return null;
    }
    if (!text.trim()) {
      return null;
    }
    try {
      return JSON.parse(text) as RealtimeIncomingMessage;
    } catch {
      return null;
    }
  }

  private safeSend(client: WebSocket, payload: unknown) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      this.logger.warn('Echec envoi WS', err as Error);
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private sendError(
    client: WebSocket,
    message: string,
    context?: string,
    requestId?: string,
  ) {
    this.safeSend(client, {
      type: 'error',
      requestId,
      context,
      payload: { message },
    });
  }

  private formatError(err: unknown): string {
    if (
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message?: unknown }).message === 'string'
    ) {
      return (err as { message: string }).message;
    }
    return 'Erreur inconnue';
  }
}
