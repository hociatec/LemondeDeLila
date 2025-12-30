import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';
import { NotificationService } from '../services/notification.service';
import { ClientUpdatesService } from '../../client-updates/client-updates.service';
import { isVersionGreater, isVersionLower } from '../../common/utils/version.utils';

type ClientMeta = { userId: number; socket: WebSocket };

@WebSocketGateway({ path: '/ws/notify' })
export class NotificationGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly clients = new Map<WebSocket, ClientMeta>();

  constructor(
    private readonly auth: WsJwtAuthService,
    private readonly notifications: NotificationService,
    private readonly clientUpdates: ClientUpdatesService,
  ) {}

  async handleConnection(client: WebSocket, ...args: any[]) {
    const token = this.auth.extractToken(client, args);
    const user = this.auth.tryVerify(token);
    if (!user?.id) {
      client.close(4001, 'auth required');
      return;
    }

    // Best-effort "early" enforcement: if the client is already below the required version,
    // tell them immediately (no need to wait for client.hello).
    try {
      const clientVersion = this.auth.extractClientVersion(client, args);
      const minRequiredVersion =
        (await this.clientUpdates.getMinRequiredVersion())?.trim() || null;
      if (minRequiredVersion) {
        const outdated =
          !clientVersion ||
          isVersionLower(clientVersion, minRequiredVersion) === true;
        if (outdated) {
          this.safeSend(client, {
            type: 'client.update.required',
            payload: {
              minRequiredVersion,
              currentVersion: clientVersion || null,
              message:
                'Une mise à jour du client est requise pour continuer.',
              publishedAt: null,
              url: (await this.clientUpdates.getLatest())?.publicUrl ?? this.clientUpdates.getPublicUrl(),
            },
          });
          client.close(4406, 'update required');
          return;
        }
      }
    } catch {
      // ignore
    }
    this.clients.set(client, { userId: user.id, socket: client });
    this.notifications.register(user.id, client);
    client.on('error', () => client.close());
    client.on('message', (data) => this.onClientMessage(client, data));
    this.safeSend(client, {
      type: 'notify.connected',
      payload: { userId: user.id },
    });
  }

  handleDisconnect(client: WebSocket) {
    const meta = this.clients.get(client);
    this.clients.delete(client);
    if (meta) {
      this.notifications.unregister(meta.userId, client);
    }
  }

  private safeSend(client: WebSocket, payload: any) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      this.logger.debug('Echec envoi WS notify', err as Error);
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private async onClientMessage(client: WebSocket, data: any) {
    const meta = this.clients.get(client);
    if (!meta) {
      return;
    }

    const raw =
      typeof data === 'string'
        ? data
        : data?.toString
          ? data.toString('utf-8')
          : '';
    if (!raw) return;

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const type = typeof parsed?.type === 'string' ? parsed.type : '';
    if (type !== 'client.hello') {
      return;
    }

    const version =
      typeof parsed?.payload?.version === 'string'
        ? parsed.payload.version.trim()
        : '';
    if (!version) return;

    try {
      const latest = await this.clientUpdates.getLatest();
      const latestVersion = latest?.version?.trim();
      const minRequiredVersion =
        (await this.clientUpdates.getMinRequiredVersion())?.trim() || null;
      const url = latest?.publicUrl ?? this.clientUpdates.getPublicUrl();

      if (minRequiredVersion) {
        const required = isVersionLower(version, minRequiredVersion);
        if (required === true) {
          this.safeSend(client, {
            type: 'client.update.required',
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
          // Send directly to this socket (no broadcast) to avoid duplicates across instances.
          this.safeSend(client, {
            type: 'client.update.available',
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
}
