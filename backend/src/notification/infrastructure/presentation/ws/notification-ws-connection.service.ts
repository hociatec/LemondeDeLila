import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { isVersionLower } from '../../../../common/utils/public-api';
import {
  WsJwtAuthService,
  WsTicketAuthService,
  WS_EVENTS,
} from '../../../../realtime/public-api';
import { UpdatePolicyService } from '../../../../update/public-api';
import { NotificationWsHandler } from './notification-ws.handler';
import { NotificationWsSessionService } from './notification-ws-session.service';
import { operationalPolicy } from '../../../../config/public-api';

@Injectable()
export class NotificationWsConnectionService {
  constructor(
    private readonly auth: WsJwtAuthService,
    private readonly updates: UpdatePolicyService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly sessions: NotificationWsSessionService,
    private readonly handler: NotificationWsHandler,
  ) {}

  async handleConnection(client: WebSocket, args: unknown[]): Promise<void> {
    const token = this.auth.extractToken(client, args);
    const user = this.auth.tryVerify(token);
    if (!user?.id) {
      client.close(4001, 'auth required');
      return;
    }
    if (!this.wsTickets.validate(client, args, 'notify')) {
      client.close(4403, 'ws ticket requis');
      return;
    }

    try {
      const clientVersion = this.auth.extractClientVersion(client, args);
      const clientProduct = this.auth.extractClientProduct(client, args);
      const minRequiredVersion =
        (await this.updates.getMinimumVersion(clientProduct))?.trim() || null;
      if (minRequiredVersion) {
        const outdated =
          !clientVersion ||
          isVersionLower(clientVersion, minRequiredVersion) === true;
        if (outdated) {
          const origin = this.extractOriginFromWsArgs(args);
          const notice = await this.updates.getNotice(
            clientProduct,
            clientVersion,
            origin,
          );
          this.sessions.safeSend(client, {
            type: WS_EVENTS.clientUpdate.required,
            payload: {
              minRequiredVersion,
              currentVersion: clientVersion || null,
              message: 'Une mise à jour du client est requise pour continuer.',
              publishedAt: notice.publishedAt,
              url: notice.url,
            },
          });
          await new Promise((resolve) =>
            setTimeout(resolve, operationalPolicy.wsReconnectBackoffMs),
          );
          client.close(4406, 'update required');
          return;
        }
      }
    } catch {
      // ignore
    }

    this.sessions.register(client, {
      userId: user.id,
      username: String(user.username || '').trim() || `user#${user.id}`,
      roles: Array.isArray(user.roles) ? user.roles : [],
      socket: client,
      origin: this.extractOriginFromWsArgs(args),
      product: this.auth.extractClientProduct(client, args),
    });

    client.on('error', () => client.close());
    client.on('message', (data) => void this.onClientMessage(client, data));

    await this.sessions.sendConnected(client, user.id);
  }

  handleDisconnect(client: WebSocket): void {
    this.sessions.unregister(client);
  }

  private async onClientMessage(
    client: WebSocket,
    data: unknown,
  ): Promise<void> {
    const meta = this.sessions.getMeta(client);
    if (!meta) {
      return;
    }

    const raw =
      typeof data === 'string'
        ? data
        : data &&
            typeof data === 'object' &&
            'toString' in data &&
            typeof (data as { toString?: unknown }).toString === 'function'
          ? (data as { toString: (encoding?: string) => string }).toString(
              'utf-8',
            )
          : '';
    if (!raw) return;

    let parsed: Record<string, unknown> | null;
    try {
      const value: unknown = JSON.parse(raw);
      parsed =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
    } catch {
      return;
    }
    if (!parsed) {
      return;
    }

    const requestId =
      typeof parsed.requestId === 'string' ? parsed.requestId : null;
    await this.handler.handle(client, meta, parsed, requestId);
  }

  private extractOriginFromWsArgs(args: unknown[]): string | null {
    try {
      const request =
        args && args[0] && typeof args[0] === 'object'
          ? (args[0] as {
              headers?: Record<string, string | string[] | undefined>;
            })
          : null;
      const headers = request?.headers || null;
      const hostHeader =
        (typeof headers?.['x-forwarded-host'] === 'string'
          ? headers['x-forwarded-host']
          : undefined) ||
        (typeof headers?.host === 'string' ? headers.host : undefined) ||
        '';
      const host = (hostHeader || '').split(',')[0]?.trim();
      if (!host) return null;

      const protoHeader =
        (headers?.['x-forwarded-proto'] as string | undefined) || 'https';
      const proto = (protoHeader || '').split(',')[0]?.trim() || 'https';
      return `${proto}://${host}`;
    } catch {
      return null;
    }
  }
}
