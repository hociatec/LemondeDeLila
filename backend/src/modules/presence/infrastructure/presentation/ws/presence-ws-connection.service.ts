import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import {
  getErrorMessage,
  isVersionLower,
} from '../../../../../shared/utils/public-api';
import type { WsAuthPayload } from '../../../../../shared/interfaces/public-api';
import {
  WsJwtAuthService,
  WsTicketAuthService,
} from '../../../../../platform/realtime/public-api';
import { UpdatePolicyService } from '../../../../update/public-api';
import { PresenceChatService } from '../../../application/services/presence-chat.service';
import { PresenceService } from '../../../application/services/presence.service';
import type { PresenceConnectionContext } from '../../../application/services/presence-state.utils';
import { PresenceWsHandler } from './presence-ws.handler';

type WsRequestLike = {
  url?: string;
};

type WsClientLike = {
  upgradeReq?: WsRequestLike;
  req?: WsRequestLike;
  url?: string;
};

@Injectable()
export class PresenceWsConnectionService {
  private readonly logger = new Logger(PresenceWsConnectionService.name);

  constructor(
    private readonly presence: PresenceService,
    private readonly chat: PresenceChatService,
    private readonly auth: WsJwtAuthService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly handler: PresenceWsHandler,
    private readonly updates: UpdatePolicyService,
  ) {}

  async handleConnection(client: WebSocket, args: unknown[]): Promise<void> {
    let payload: WsAuthPayload | null;
    try {
      payload = this.resolveAuth(client, args);
    } catch {
      this.sendError(client, "Le token d'authentification est invalide.");
      client.close(4001, 'invalid ws token');
      return;
    }

    if (!payload || !payload.id || !payload.username) {
      this.sendError(client, 'Authentification requise pour ouvrir le tchat.');
      client.close(4001, 'auth required');
      return;
    }

    if (!this.wsTickets.validate(client, args, 'presence')) {
      this.sendError(
        client,
        'Le ticket WebSocket est requis pour se connecter.',
      );
      client.close(4403, 'ws ticket requis');
      return;
    }

    const version = this.auth.extractClientVersion(client, args);
    const product = this.auth.extractClientProduct(client, args);
    const minimum = await this.updates.getMinimumVersion(product);
    if (minimum && (!version || isVersionLower(version, minimum) === true)) {
      this.sendError(
        client,
        `Mise à jour requise (version minimale: ${minimum}).`,
      );
      client.close(4406, 'update required');
      return;
    }

    const context = this.resolveContext(client, args);
    if (context === 'chat') {
      const banned = await this.chat.getActiveChatBanPayload(payload.id);
      if (banned) {
        this.safeSend(client, { type: 'error', payload: banned });
        client.close(4403, 'chat banned');
        return;
      }
    }

    this.presence.register(client, payload, context);
    client.on(
      'message',
      (raw) => void this.handler.handleIncoming(client, raw),
    );
    client.on('error', () => client.close());

    if (context === 'chat') {
      await this.presence.sendHistory(client);
    }

    this.presence.broadcastPresence();
  }

  handleDisconnect(client: WebSocket): void {
    this.presence.unregister(client);
    this.presence.broadcastPresence();
  }

  private resolveAuth(
    client: WebSocket,
    args: unknown[],
  ): WsAuthPayload | null {
    const token = this.auth.extractToken(client, args);
    if (!token) {
      return null;
    }

    try {
      return this.auth.verify(token);
    } catch (err) {
      this.logger.warn(`Token WS invalide: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  private resolveContext(
    client: WebSocket,
    args: unknown[],
  ): PresenceConnectionContext {
    const wsClient = client as WsClientLike;
    const request =
      ((args && args[0]) as WsRequestLike | undefined) ??
      wsClient.upgradeReq ??
      wsClient.req;
    const urlCandidate = wsClient.url || request?.url || '';

    try {
      const url = new URL(urlCandidate, 'ws://localhost');
      const raw = (url.searchParams.get('context') || '').toLowerCase();
      if (raw === 'chat') {
        return 'chat';
      }
    } catch {
      /* ignore */
    }

    return 'home';
  }

  private sendError(client: WebSocket, message: string): void {
    this.safeSend(client, {
      type: 'error',
      payload: { message },
    });
  }

  private safeSend(client: WebSocket, payload: unknown): void {
    try {
      client.send(JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }
}
