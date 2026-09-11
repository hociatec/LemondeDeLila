import { RealtimeSessionPersistenceService } from './realtime-session-persistence.service';
import { Inject } from '@nestjs/common';
import { WsWorkService } from '../../../../ws/public-api';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WebSocket } from 'ws';
import type { WsAuthPayload } from '../../../../../shared/interfaces/public-api';
import {
  getErrorMessage,
  parseStrictInteger,
} from '../../../../../shared/utils/public-api';
import { PerfMetricsService } from '../../../../observability/public-api';
import {
  WsApiHubService,
  WsJwtAuthService,
  type WsTicketScope,
  WsTicketAuthService,
} from '../../../../ws/public-api';
import { RealtimeApiHandlerService } from './realtime-api-handler.service';
import type { RealtimeClientSession } from './realtime-api.types';

@Injectable()
export class RealtimeApiConnectionService {
  private readonly clients = new Map<WebSocket, RealtimeClientSession>();
  private readonly logger = new Logger(RealtimeApiConnectionService.name);

  constructor(
    private readonly auth: WsJwtAuthService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly hub: WsApiHubService,
    private readonly handler: RealtimeApiHandlerService,
    private readonly perf: PerfMetricsService,
    private readonly sessions: RealtimeSessionPersistenceService,
    @Inject(WsWorkService) private readonly work = new WsWorkService(),
  ) {}

  handleConnection(
    client: WebSocket,
    args: unknown[],
    scope: WsTicketScope = 'api',
  ): Promise<void> {
    return this.work.run(client, () =>
      this.openConnection(client, args, scope),
    );
  }

  private async openConnection(
    client: WebSocket,
    args: unknown[],
    scope: WsTicketScope = 'api',
  ): Promise<void> {
    const connectionId = randomUUID();
    const clientVersion = this.auth.extractClientVersion(client, args);
    const clientProduct = this.auth.extractClientProduct(client, args);
    const token = this.auth.extractToken(client, args);
    const ticketValidation = this.wsTickets.validateIfTokenPresentDetailed(
      client,
      args,
      scope,
      Boolean(token),
    );
    if (!ticketValidation.ok) {
      this.perf.record('ws.connection.rejected', 0, {
        scope,
        reason: ticketValidation.reason,
      });
      this.logger.warn(
        `Connexion WS refusée (ticket) reason=${ticketValidation.reason} hasToken=${Boolean(token)} clientVersion=${clientVersion ?? 'n/a'} connectionId=${connectionId}`,
      );
      try {
        const reason =
          ticketValidation.reason === 'missing_ticket'
            ? 'ws ticket requis'
            : 'ws ticket invalide';
        client.close(4403, reason);
      } catch {
        /* ignore */
      }
      return;
    }

    const gameContext =
      scope === 'game' ? this.extractGameContext(client, args) : {};
    const session: RealtimeClientSession = {
      socket: client,
      user: this.resolveUser(token),
      connectionId,
      clientVersion,
      clientProduct,
      scope,
      peerAddress: this.peerAddress(args),
      ...gameContext,
    };

    this.clients.set(client, session);
    this.hub.register(connectionId, client, {
      scope,
      roomId: session.roomId ?? null,
      gameType: session.gameType ?? null,
      userId: session.user?.id ?? null,
    });
    this.perf.record('ws.connection.opened', 0, {
      scope,
      authenticated: session.user != null,
    });

    client.on(
      'message',
      (raw) =>
        void this.work.run(client, () =>
          this.handler.handleIncoming(client, session, raw),
        ),
    );
    client.on('error', () => {
      this.perf.record('ws.connection.error', 0, { scope });
      client.close();
    });

    await this.sessions.persistSession(session);
    if (scope === 'game') {
      await this.sendInitialGameStateIfRequested(client, session);
    }
  }

  handleDisconnect(client: WebSocket): Promise<void> {
    return this.work.run(client, () => this.disconnect(client), true);
  }

  private async disconnect(client: WebSocket): Promise<void> {
    const session = this.clients.get(client);
    this.clients.delete(client);
    if (!session) {
      return;
    }
    this.perf.record('ws.connection.closed', 0, {
      scope: session.scope ?? 'api',
    });

    await this.sessions.clearSession(session.connectionId);
    this.hub.unregister(session.connectionId);
  }

  private peerAddress(args: unknown[]): string {
    const request = args[0];
    if (!request || typeof request !== 'object' || !('socket' in request))
      return 'unknown';
    const socket = request.socket;
    if (!socket || typeof socket !== 'object' || !('remoteAddress' in socket))
      return 'unknown';
    return typeof socket.remoteAddress === 'string'
      ? socket.remoteAddress.slice(0, 128)
      : 'unknown';
  }

  private resolveUser(token: string | null): WsAuthPayload | null {
    if (!token) {
      return null;
    }

    try {
      return this.auth.verify(token);
    } catch (err) {
      this.logger.warn(
        `Connexion WS sans auth valide: ${getErrorMessage(err)}`,
      );
      return null;
    }
  }

  private async sendInitialGameStateIfRequested(
    client: WebSocket,
    session: RealtimeClientSession,
  ): Promise<void> {
    try {
      const roomId = Number(session.roomId ?? 0);
      if (!Number.isSafeInteger(roomId) || roomId <= 0) return;
      const gameType = String(session.gameType ?? '').trim().slice(0, 100);
      await this.handler.handleIncoming(
        client,
        session,
        JSON.stringify({
          type: 'game.join',
          payload: { roomId, ...(gameType ? { gameType } : {}) },
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Initial game.state impossible connectionId=${session.connectionId}: ${getErrorMessage(err)}`,
      );
    }
  }

  private extractGameContext(
    client: WebSocket,
    args: unknown[],
  ): { roomId?: number | null; gameType?: string | null } {
    const url = this.extractUrl(client, args);
    if (!url) return {};
    try {
      const parsed = new URL(url, 'ws://localhost');
      const roomId = parseStrictInteger(
        parsed.searchParams.get('roomId') ?? parsed.searchParams.get('room'),
        { min: 1 },
      );
      const gameType = String(parsed.searchParams.get('gameType') ?? '').trim();
      if (gameType.length > 100) return {};
      return {
        roomId,
        gameType: gameType || null,
      };
    } catch {
      return {};
    }
  }

  private extractUrl(client: WebSocket, args: unknown[]): string | null {
    const firstArg = args[0];
    if (firstArg && typeof firstArg === 'object' && 'url' in firstArg) {
      const url = (firstArg as { url?: unknown }).url;
      if (typeof url === 'string' && url.trim()) {
        return url.slice(0, 4_096);
      }
    }
    const clientUrl = 'url' in client ? client.url : undefined;
    return typeof clientUrl === 'string' && clientUrl.trim()
      ? clientUrl.slice(0, 4_096)
      : null;
  }
}
