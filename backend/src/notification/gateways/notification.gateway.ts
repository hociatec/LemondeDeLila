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
      if (!latestVersion) {
        return;
      }

      if (!isUpdateAvailable(latestVersion, version)) {
        return;
      }

      // Send directly to this socket (no broadcast) to avoid duplicates across instances.
      this.safeSend(client, {
        type: 'client.update.available',
        payload: {
          version: latestVersion,
          message: latest?.message ?? null,
          publishedAt: latest?.publishedAt ?? null,
          url: latest?.publicUrl ?? this.clientUpdates.getPublicUrl(),
        },
      });
    } catch (err) {
      this.logger.debug('Echec vérification version client', err as Error);
    }
  }
}

function isUpdateAvailable(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  return a > b;
}

function parseVersion(value: string): number | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const parts = raw
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 1 || parts.length > 4) return null;

  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    nums.push(Number(p));
  }
  while (nums.length < 4) nums.push(0);

  return nums[0] * 1_000_000_000 + nums[1] * 1_000_000 + nums[2] * 1_000 + nums[3];
}
