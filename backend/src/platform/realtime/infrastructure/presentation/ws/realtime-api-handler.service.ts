import { RealtimeApiTransportService } from './realtime-api-transport.service';
import { WS_EVENTS } from './ws-events';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import {
  CLIENT_VERSION_READER,
  type ClientVersionReader,
} from '../../../application/ports/client-version-reader.port';
import {
  getErrorMessage,
  isVersionLower,
} from '../../../../../shared/utils/public-api';
import { getErrorPayload } from '../../../../serialization/public-api';
import {
  WsRouteRegistry,
  WsRequestRateLimitService,
} from '../../../../ws/public-api';
import {
  inSpan,
  normalizeCorrelationId,
  PerfMetricsService,
  prometheusMetrics,
  runWithCorrelationId,
} from '../../../../observability/public-api';
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
    @Inject(CLIENT_VERSION_READER)
    private readonly updates: ClientVersionReader,
    private readonly transport: RealtimeApiTransportService,
    private readonly replay: RealtimeRequestReplayService,
    private readonly perf: PerfMetricsService,
    private readonly rateLimit: WsRequestRateLimitService,
  ) {}

  async handleIncoming(
    client: WebSocket,
    session: RealtimeClientSession,
    raw: unknown,
  ): Promise<void> {
    const decoded = this.transport.decode(raw);
    if (!decoded) {
      this.perf.record('ws.message.rejected', 0, { reason: 'invalid' });
      this.logger.warn(
        `Message WS rejeté (invalide ou sans type) connectionId=${session.connectionId}`,
      );
      this.transport.error(client, 'Message WebSocket invalide');
      return;
    }

    const authentication =
      decoded.type === WS_EVENTS.auth.login ||
      decoded.type === WS_EVENTS.auth.register ||
      decoded.type === WS_EVENTS.auth.refresh;
    if (
      !(await this.rateLimit.allow(
        session.user?.id,
        session.peerAddress,
        authentication ? 'authentication' : 'standard',
      ))
    ) {
      this.perf.record('ws.message.rejected', 0, {
        reason: 'rate-limit',
        type: decoded.type,
      });
      this.transport.error(
        client,
        'Trop de requêtes ou quota indisponible',
        decoded.type,
        decoded.requestId,
      );
      return;
    }
    const correlationId = normalizeCorrelationId(decoded.requestId);
    await runWithCorrelationId(correlationId, () =>
      this.handleDecoded(client, session, decoded),
    );
  }

  private async handleDecoded(
    client: WebSocket,
    session: RealtimeClientSession,
    decoded: RealtimeIncomingMessage & { type: string },
  ): Promise<void> {
    const { type, payload, requestId } = decoded;
    const replay = this.replay.begin(session, type, requestId, payload);
    if (replay.kind === 'busy') {
      this.transport.error(
        client,
        'Trop de commandes récentes. Réessayez dans quelques instants.',
        type,
        requestId,
      );
      return;
    }
    if (replay.kind === 'collision') {
      this.transport.error(
        client,
        'requestId déjà utilisé pour une commande ou un payload différent',
        type,
        requestId,
      );
      return;
    }
    if (replay.kind === 'replay') {
      this.perf.record('ws.reconnect.replay', 0, { type });
      for (const frame of await replay.frames)
        this.transport.send(client, frame);
      return;
    }
    try {
      if (await this.rejectOutdatedClient(client, session, type, requestId)) {
        replay.fail();
        return;
      }
    } catch (error) {
      replay.fail();
      this.transport.error(client, getErrorPayload(error), type, requestId);
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
    const startedAt = process.hrtime.bigint();
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
        this.transport.error(
          client,
          'Type de message inconnu',
          type,
          requestId,
        );
        replay.fail();
        return;
      }

      const start = process.hrtime.bigint();
      this.logger.debug(
        `WS -> backend type=${type} requestId=${requestId ?? 'n/a'} userId=${session.user?.id ?? 'anon'} connectionId=${session.connectionId}`,
      );
      const response = await inSpan(
        `ws ${type}`,
        {
          'messaging.system': 'websocket',
          'messaging.operation.name': type,
          'lila.connection.authenticated': session.user !== null,
        },
        () => handler(session, payload),
      );
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      this.logHandlerDuration(type, requestId, elapsedMs);
      const responseItems = response ? [response] : [];
      const frames: RealtimeResponseFrame[] = responseItems.map((item) => ({
        requestId,
        ...item,
      }));
      replay.complete(frames);
      for (const frame of frames) this.transport.send(client, frame);
      prometheusMetrics.recordWebSocket(
        type,
        'success',
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
      );
    } catch (err) {
      prometheusMetrics.recordWebSocket(
        type,
        'error',
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
      );
      this.perf.record('ws.handler.error', 0, { type });
      this.logger.error(
        `Erreur handler WS type=${type} requestId=${requestId ?? 'n/a'} userId=${session.user?.id ?? 'anon'} connectionId=${session.connectionId}: ${getErrorMessage(err, 'Erreur inconnue')}`,
        err instanceof Error ? err.stack : undefined,
      );
      const frame = this.transport.errorFrame(
        getErrorPayload(err, 'Erreur inconnue'),
        type,
        requestId,
      );
      replay.complete([frame]);
      this.transport.send(client, frame);
    }
  }

  private logHandlerDuration(
    type: string,
    requestId: string | undefined,
    elapsedMs: number,
  ): void {
    const message = `WS handler ${elapsedMs >= 2000 ? 'lent' : 'ok'}: ${type} (${elapsedMs}ms) requestId=${requestId ?? 'n/a'}`;
    if (elapsedMs >= 2000) this.logger.warn(message);
    else this.logger.debug(message);
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
    this.transport.error(
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
}
