import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WebSocket } from 'ws';
import type { WsAuthPayload } from '../../../../common/interfaces/public-api';
import { WsApiHubService } from '../../../../realtime/public-api';
import { WsJwtAuthService } from '../../../../realtime/public-api';
import { WsTicketAuthService } from '../../../../realtime/public-api';
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
  ) {}

  async handleConnection(client: WebSocket, args: unknown[]): Promise<void> {
    const connectionId = randomUUID();
    const clientVersion = this.auth.extractClientVersion(client, args);
    const token = this.auth.extractToken(client, args);
    const ticketValidation = this.wsTickets.validateIfTokenPresentDetailed(
      client,
      args,
      'api',
      Boolean(token),
    );
    if (!ticketValidation.ok) {
      this.logger.warn(
        `Connexion WS refusÃ©e (ticket) reason=${ticketValidation.reason} hasToken=${Boolean(token)} clientVersion=${clientVersion ?? 'n/a'} connectionId=${connectionId}`,
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

    const session: RealtimeClientSession = {
      socket: client,
      user: this.resolveUser(token),
      connectionId,
      clientVersion,
    };

    this.clients.set(client, session);
    this.hub.register(connectionId, client);

    client.on(
      'message',
      (raw) => void this.handler.handleIncoming(client, session, raw),
    );
    client.on('error', () => client.close());

    await this.handler.persistSession(session);
  }

  handleDisconnect(client: WebSocket): void {
    const session = this.clients.get(client);
    this.clients.delete(client);
    if (!session) {
      return;
    }

    void this.handler.clearSession(session.connectionId);
    this.hub.unregister(session.connectionId);
  }

  private resolveUser(token: string | null): WsAuthPayload | null {
    if (!token) {
      return null;
    }

    try {
      return this.auth.verify(token);
    } catch (err) {
      this.logger.warn(
        `Connexion WS sans auth valide: ${(err as Error).message}`,
      );
      return null;
    }
  }
}

