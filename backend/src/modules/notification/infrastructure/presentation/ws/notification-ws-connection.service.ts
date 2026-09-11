import { Inject } from '@nestjs/common';
import { WsWorkService } from '../../../../../platform/ws/public-api';
import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { WsRequestRateLimitService } from '../../../../../platform/ws/public-api';
import { isVersionLower } from '../../../../../shared/utils/public-api';
import {
  WsJwtAuthService,
  WsTicketAuthService,
  WS_EVENTS,
} from '../../../../../platform/realtime/public-api';
import { decodeWsEnvelope } from '../../../../../platform/ws/public-api';
import { ClientUpdateQueryService } from '../../../../update/public-api';
import { NotificationWsHandler } from './notification-ws.handler';
import { NotificationWsSessionService } from './notification-ws-session.service';
import { operationalSettings } from '../../../../../platform/config/public-api';
import { isBoundedJsonInput } from '../../../../../platform/validation/public-api';

@Injectable()
export class NotificationWsConnectionService {
  constructor(
    private readonly auth: WsJwtAuthService,
    private readonly updates: ClientUpdateQueryService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly sessions: NotificationWsSessionService,
    private readonly handler: NotificationWsHandler,
    private readonly rateLimit: WsRequestRateLimitService,
    @Inject(WsWorkService) private readonly work = new WsWorkService(),
  ) {}

  handleConnection(client: WebSocket, args: unknown[]): Promise<void> {
    return this.work.run(client, () => this.openConnection(client, args));
  }

  private async openConnection(
    client: WebSocket,
    args: unknown[],
  ): Promise<void> {
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
            setTimeout(resolve, operationalSettings.wsReconnectBackoffMs),
          );
          client.close(4406, 'update required');
          return;
        }
      }
    } catch {
      // ignore
    }

    await this.sessions.register(client, {
      userId: user.id,
      username: String(user.username || '').trim() || `user#${user.id}`,
      roles: Array.isArray(user.roles) ? user.roles : [],
      socket: client,
      origin: this.extractOriginFromWsArgs(args),
      product: this.auth.extractClientProduct(client, args),
    });

    client.on('error', () => client.close());
    client.on(
      'message',
      (data) =>
        void this.work.run(client, () => this.onClientMessage(client, data)),
    );

    await this.sessions.sendConnected(client, user.id);
  }

  handleDisconnect(client: WebSocket): Promise<void> {
    return this.work.run(client, () => this.sessions.unregister(client), true);
  }

  private async onClientMessage(
    client: WebSocket,
    data: unknown,
  ): Promise<void> {
    const meta = this.sessions.getMeta(client);
    if (!meta) {
      return;
    }
    if (!(await this.rateLimit.allow(meta.userId))) {
      client.close(1013, 'rate limit');
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
    const value = raw;
    if (!isBoundedJsonInput(value)) return;
    const parsed = decodeWsEnvelope(raw);
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
