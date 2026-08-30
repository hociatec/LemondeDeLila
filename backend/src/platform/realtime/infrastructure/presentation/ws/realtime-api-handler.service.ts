import { Inject, Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { ConfigService } from '@nestjs/config';
import {
  CLIENT_VERSION_POLICY,
  type ClientVersionPolicy,
} from '../../../application/ports/client-version-policy.port';
import {
  SESSION_STORE,
  type SessionStateStore,
} from '../../../../session/public-api';
import {
  getErrorDetails,
  getErrorMessage,
  getErrorPayload,
  bestEffort,
  isVersionLower,
  type PresentedErrorPayload,
} from '../../../../../shared/utils/public-api';
import { WsRouteRegistry } from '../../../../ws/public-api';
import { PerfMetricsService } from '../../../../observability/public-api';
import type {
  RealtimeClientSession,
  RealtimeIncomingMessage,
} from './realtime-api.types';
import {
  RealtimeRequestReplayService,
  type RealtimeResponseFrame,
} from './realtime-request-replay.service';

@Injectable()
export class RealtimeApiHandlerService {
  private readonly logger = new Logger(RealtimeApiHandlerService.name);

  constructor(
    private readonly registry: WsRouteRegistry,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStateStore,
    @Inject(CLIENT_VERSION_POLICY)
    private readonly updates: ClientVersionPolicy,
    private readonly config: ConfigService,
    private readonly replay: RealtimeRequestReplayService,
    private readonly perf: PerfMetricsService,
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
        `Impossible de persister la session WS (connectionId=${session.connectionId}): ${getErrorMessage(err)}`,
      );
    }
  }

  async clearSession(connectionId: string): Promise<void> {
    await bestEffort(
      this.sessionStore.delete(connectionId),
      `suppression session realtime connection=${connectionId}`,
      this.logger,
    );
  }

  async handleIncoming(
    client: WebSocket,
    session: RealtimeClientSession,
    raw: unknown,
  ): Promise<void> {
    const decoded = this.decode(raw);
    if (!decoded) {
      this.perf.record('ws.message.rejected', 0, { reason: 'invalid' });
      this.logger.warn(
        `Message WS rejeté (invalide ou sans type) connectionId=${session.connectionId}`,
      );
      this.sendError(client, 'Message WebSocket invalide');
      return;
    }

    await this.handleDecoded(client, session, decoded);
  }

  private async handleDecoded(
    client: WebSocket,
    session: RealtimeClientSession,
    decoded: RealtimeIncomingMessage & { type: string },
  ): Promise<void> {
    const { type, payload, requestId } = decoded;
    const replay = this.replay.begin(session, type, requestId);
    if (replay.kind === 'collision') {
      this.sendError(
        client,
        'requestId déjà utilisé pour une autre commande',
        type,
        requestId,
      );
      return;
    }
    if (replay.kind === 'replay') {
      this.perf.record('ws.reconnect.replay', 0, { type });
      for (const frame of await replay.frames) this.safeSend(client, frame);
      return;
    }
    if (!this.consumeRateLimit(session)) {
      this.perf.record('ws.message.rejected', 0, {
        reason: 'rate-limit',
        type,
      });
      this.logger.warn(
        JSON.stringify({
          event: 'ws.rate_limit.rejected',
          connectionId: session.connectionId,
          userId: session.user?.id ?? null,
          type,
        }),
      );
      this.sendError(client, 'Trop de requêtes', type, requestId);
      replay.fail();
      return;
    }
    if (await this.rejectOutdatedClient(client, session, type, requestId)) {
      replay.fail();
      return;
    }

    await this.executeHandler(
      client,
      session,
      type,
      payload,
      requestId,
      replay,
    );
  }

  private async executeHandler(
    client: WebSocket,
    session: RealtimeClientSession,
    type: string,
    payload: unknown,
    requestId: string | undefined,
    replay: Extract<
      ReturnType<RealtimeRequestReplayService['begin']>,
      { kind: 'execute' }
    >,
  ): Promise<void> {
    try {
      if (type === 'r' || type === 'R') {
        replay.complete([]);
        return;
      }

      const handler = this.registry.get(type);
      if (!handler) {
        this.logger.warn(
          `Type WS inconnu: ${type} (requestId=${requestId ?? 'n/a'})`,
        );
        this.sendError(client, 'Type de message inconnu', type, requestId);
        replay.fail();
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
      const responseItems = response ? [response] : [];
      const frames: RealtimeResponseFrame[] = responseItems.map((item) => ({
        requestId,
        ...item,
      }));
      replay.complete(frames);
      for (const frame of frames) this.safeSend(client, frame);
    } catch (err) {
      this.perf.record('ws.handler.error', 0, { type });
      this.logger.error(
        `Erreur handler WS type=${type} requestId=${requestId ?? 'n/a'} userId=${session.user?.id ?? 'anon'} connectionId=${session.connectionId}: ${getErrorMessage(err, 'Erreur inconnue')}`,
        err instanceof Error ? err.stack : undefined,
      );
      const frame = this.errorFrame(
        getErrorPayload(err, 'Erreur inconnue'),
        type,
        requestId,
      );
      replay.complete([frame]);
      this.safeSend(client, frame);
    }
  }

  private async rejectOutdatedClient(
    client: WebSocket,
    session: RealtimeClientSession,
    type: string,
    requestId?: string,
  ): Promise<boolean> {
    const minimum = await this.updates.getMinimumVersion(session.clientProduct);
    if (
      !minimum ||
      (session.clientVersion &&
        isVersionLower(session.clientVersion, minimum) !== true)
    ) {
      return false;
    }
    this.sendError(
      client,
      `Mise à jour requise (version minimale: ${minimum}).`,
      type,
      requestId,
    );
    try {
      client.close(4406, 'update required');
    } catch {
      /* ignore */
    }
    return true;
  }

  private decode(raw: unknown): RealtimeIncomingMessage | null {
    let text: string;
    if (typeof raw === 'string') {
      text = raw;
    } else if (Buffer.isBuffer(raw)) {
      text = raw.toString('utf-8');
    } else if (raw instanceof ArrayBuffer) {
      text = Buffer.from(raw).toString('utf-8');
    } else {
      return null;
    }
    if (!text.trim()) {
      return null;
    }
    const maxPayloadBytes = this.config.get<number>(
      'WS_MAX_PAYLOAD_BYTES',
      65_536,
    );
    if (Buffer.byteLength(text, 'utf8') > maxPayloadBytes) return null;
    try {
      const parsed: unknown = JSON.parse(text);
      if (
        !isRecord(parsed) ||
        Object.keys(parsed).some(
          (key) => !['type', 'payload', 'requestId'].includes(key),
        ) ||
        typeof parsed.type !== 'string' ||
        parsed.type.length === 0 ||
        parsed.type.length > 100 ||
        (parsed.requestId !== undefined &&
          (typeof parsed.requestId !== 'string' ||
            parsed.requestId.length > 128))
      ) {
        return null;
      }
      return {
        type: parsed.type,
        payload: parsed.payload,
        requestId: parsed.requestId,
      };
    } catch {
      return null;
    }
  }

  private consumeRateLimit(session: RealtimeClientSession): boolean {
    const now = Date.now();
    const windowMs = this.config.get<number>('WS_RATE_LIMIT_WINDOW_MS', 10_000);
    const limit = this.config.get<number>('WS_RATE_LIMIT_COUNT', 60);
    const current = session.rateLimit;
    if (!current || now - current.windowStartedAtMs >= windowMs) {
      session.rateLimit = { windowStartedAtMs: now, count: 1 };
      return true;
    }
    current.count += 1;
    return current.count <= limit;
  }

  private safeSend(client: WebSocket, payload: unknown) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      this.logger.warn('Echec envoi WS', getErrorDetails(err));
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private sendError(
    client: WebSocket,
    error: string | PresentedErrorPayload,
    context?: string,
    requestId?: string,
  ) {
    this.safeSend(client, this.errorFrame(error, context, requestId));
  }

  private errorFrame(
    error: string | PresentedErrorPayload,
    context?: string,
    requestId?: string,
  ): RealtimeResponseFrame {
    return {
      type: 'error',
      requestId,
      context,
      payload: typeof error === 'string' ? { message: error } : error,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
