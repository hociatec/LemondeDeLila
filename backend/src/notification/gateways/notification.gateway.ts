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
import { ClientUpdatesService } from '../../client-updates/services/client-updates.service';
import { isVersionGreater, isVersionLower } from '../../common/utils/version.utils';
import { WsTicketAuthService } from '../../common/ws/ws-ticket-auth.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialRelationship } from '../../social/entities/social-relationship.entity';
import { AdminContactService } from '../services/admin-contact.service';
import { UserBadgeCountsService } from '../services/user-badge-counts.service';

type ClientMeta = {
  userId: number;
  username: string;
  roles: string[];
  socket: WebSocket;
  origin: string | null;
};

@WebSocketGateway({ path: '/ws/notify' })
export class NotificationGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly clients = new Map<WebSocket, ClientMeta>();
  private readonly socketCountsByUserId = new Map<number, number>();

  constructor(
    private readonly auth: WsJwtAuthService,
    private readonly notifications: NotificationService,
    private readonly clientUpdates: ClientUpdatesService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly adminContacts: AdminContactService,
    private readonly counts: UserBadgeCountsService,
    @InjectRepository(SocialRelationship)
    private readonly relationships: Repository<SocialRelationship>,
  ) {}

  private extractOriginFromWsArgs(args: any[]): string | null {
    try {
      const request: any = (args && args[0]) || null;
      const headers = request?.headers || null;
      const hostHeader =
        (headers?.['x-forwarded-host'] as string | undefined) ||
        (headers?.host as string | undefined) ||
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

  async handleConnection(client: WebSocket, ...args: any[]) {
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
          const origin = this.extractOriginFromWsArgs(args);
          const latest = await this.clientUpdates.getLatest();
          this.safeSend(client, {
            type: 'client.update.required',
            payload: {
              minRequiredVersion,
              currentVersion: clientVersion || null,
              message:
                'Une mise à jour du client est requise pour continuer.',
              publishedAt: null,
              url: this.clientUpdates.resolveClientPublicUrlForOrigin(
                latest,
                origin,
              ),
            },
          });
          client.close(4406, 'update required');
          return;
        }
      }
    } catch {
      // ignore
    }

    const prevCount = this.socketCountsByUserId.get(user.id) ?? 0;
    this.clients.set(client, {
      userId: user.id,
      username: String(user.username || '').trim() || `user#${user.id}`,
      roles: Array.isArray(user.roles) ? user.roles : [],
      socket: client,
      origin: this.extractOriginFromWsArgs(args),
    });
    this.notifications.register(user.id, client);
    this.socketCountsByUserId.set(user.id, prevCount + 1);
    if (prevCount === 0) {
      void this.notifyFriendsPresence(user.id, user.username, true);
    }
    client.on('error', () => client.close());
    client.on('message', (data) => this.onClientMessage(client, data));
    this.safeSend(client, {
      type: 'notify.connected',
      payload: { userId: user.id },
    });

    // Push counts at connect (source of truth for badges).
    try {
      const payload = await this.counts.getCounts(user.id);
      this.logger.log(`notify.counts initial push for user ${user.id}: ${JSON.stringify(payload)}`);
      this.safeSend(client, { type: 'notify.counts', payload });
    } catch {
      this.logger.warn(
        `notify.counts initial push failed for user ${user.id}; client will retry`,
      );
      // Even on failure, send zeros to avoid client timeouts.
      this.safeSend(client, {
        type: 'notify.counts',
        payload: { unreadNotifications: 0, unreadMessages: 0 },
      });
    }
  }

  handleDisconnect(client: WebSocket) {
    const meta = this.clients.get(client);
    this.clients.delete(client);
    if (meta) {
      this.notifications.unregister(meta.userId, client);

      const prevCount = this.socketCountsByUserId.get(meta.userId) ?? 0;
      const nextCount = Math.max(0, prevCount - 1);
      if (nextCount === 0) {
        this.socketCountsByUserId.delete(meta.userId);
        void this.notifyFriendsPresence(meta.userId, null, false);
      } else {
        this.socketCountsByUserId.set(meta.userId, nextCount);
      }
    }
  }

  private async notifyFriendsPresence(
    userId: number,
    username: string | null | undefined,
    isOnline: boolean,
  ): Promise<void> {
    if (!userId) return;

    try {
      const relations = await this.relationships.find({
        where: [
          { requester: { id: userId }, status: 'accepted' },
          { addressee: { id: userId }, status: 'accepted' },
        ],
      });

      const friendIds = relations
        .map((relation) =>
          relation.requester?.id === userId
            ? relation.addressee?.id
            : relation.requester?.id,
        )
        .filter(
          (id): id is number =>
            typeof id === 'number' && id > 0 && id !== userId,
        );

      if (friendIds.length === 0) return;

      const type = isOnline
        ? 'social.friend.connected'
        : 'social.friend.disconnected';
      const payload = {
        userId,
        username: String(username || '').trim() || `user#${userId}`,
      };

      this.logger.log(
        `Notify friends presence: user=${userId} ${isOnline ? 'online' : 'offline'} -> friends=${friendIds.join(',')}`,
      );

      await Promise.all(
        friendIds.map((fid) => this.notifications.notifyUser(fid, type, payload)),
      );
    } catch (err) {
      this.logger.debug('Friend notify failed', err as Error);
    }
  }

  private safeSend(client: WebSocket, payload: any) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      const type =
        payload && typeof payload === 'object' && typeof payload.type === 'string'
          ? payload.type
          : 'unknown';
      this.logger.warn(
        `Echec envoi WS notify (type=${type}) : ${(err as Error).message}`,
      );
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
    if (!type) return;
    const requestId =
      typeof parsed?.requestId === 'string' ? parsed.requestId : null;

    if (type === 'notify.counts.get') {
      this.logger.log(
        `notify.counts.get received user=${meta.userId} requestId=${requestId ?? 'none'}`,
      );
      try {
        const payload = await this.counts.getCounts(meta.userId);
        this.logger.log(
          `notify.counts.get for user ${meta.userId}: ${JSON.stringify(payload)}`,
        );
        this.safeSendResponse(client, 'notify.counts', payload, requestId);
      } catch {
        this.logger.warn(
          `notify.counts.get failed for user ${meta.userId}, returning zeros`,
        );
        this.safeSendResponse(
          client,
          'notify.counts',
          { unreadNotifications: 0, unreadMessages: 0 },
          requestId,
        );
      }
      return;
    }

    if (type === 'notify.inbox.list') {
      try {
        const items = await this.adminContacts.listInbox(meta.userId, 200);
        this.safeSendResponse(
          client,
          'notify.inbox.snapshot',
          { items },
          requestId,
        );
      } catch {
        this.safeSendResponse(
          client,
          'notify.inbox.snapshot',
          { items: [] },
          requestId,
        );
      }
      return;
    }

    if (type === 'notify.inbox.delete') {
      const id = typeof parsed?.payload?.id === 'string' ? parsed.payload.id.trim() : '';
      if (!id) return;
      try {
        await this.adminContacts.deleteInboxItem(meta.userId, id);
        const items = await this.adminContacts.listInbox(meta.userId, 200);
        this.safeSendResponse(
          client,
          'notify.inbox.snapshot',
          { items },
          requestId,
        );
      } catch {
        // ignore
      }
      return;
    }

    if (type === 'notify.inbox.markRead') {
      const id = typeof parsed?.payload?.id === 'string' ? parsed.payload.id.trim() : '';
      if (!id) return;
      try {
        await this.adminContacts.markRead(meta.userId, id);
        this.safeSendResponse(client, 'notify.inbox.markRead', { ok: true }, requestId);
      } catch {
        // ignore
      }
      return;
    }

    if (type === 'notify.admin_contact.send') {
      try {
        const message = typeof parsed?.payload?.message === 'string' ? parsed.payload.message : '';
        const item = await this.adminContacts.sendFromUserToStaff(
          { id: meta.userId, username: meta.username, roles: meta.roles } as any,
          message,
        );
        this.safeSendResponse(
          client,
          'notify.admin_contact.sent',
          { id: item.id, contactId: item.contactId },
          requestId,
        );
      } catch (err: any) {
        this.safeSendResponse(
          client,
          'notify.admin_contact.error',
          { message: String(err?.message || 'Erreur') },
          requestId,
        );
      }
      return;
    }

    if (type === 'notify.admin_contact.reply') {
      try {
        const from = { id: meta.userId, username: meta.username, roles: meta.roles } as any;
        const message = typeof parsed?.payload?.message === 'string' ? parsed.payload.message : '';
        const contactId = typeof parsed?.payload?.contactId === 'string' ? parsed.payload.contactId : '';
        const toUserId = typeof parsed?.payload?.toUserId === 'number' ? parsed.payload.toUserId : 0;
        const isStaff =
          Array.isArray((from as any).roles) &&
          ((from as any).roles.includes('ROLE_ADMIN') ||
            (from as any).roles.includes('admin') ||
            (from as any).roles.includes('ROLE_MODERATOR') ||
            (from as any).roles.includes('moderator'));
        const item = isStaff
          ? await this.adminContacts.replyFromStaffToUser(from, toUserId, message, contactId)
          : await this.adminContacts.sendFromUserToStaff(from, message, contactId);
        this.safeSendResponse(
          client,
          'notify.admin_contact.sent',
          { id: item.id, contactId: item.contactId },
          requestId,
        );
      } catch (err: any) {
        this.safeSendResponse(
          client,
          'notify.admin_contact.error',
          { message: String(err?.message || 'Erreur') },
          requestId,
        );
      }
      return;
    }

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
      const url = this.clientUpdates.resolveClientPublicUrlForOrigin(
        latest,
        meta.origin,
      );

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

  private safeSendResponse(
    client: WebSocket,
    type: string,
    payload: any,
    requestId: string | null,
  ) {
    this.safeSend(client, requestId ? { type, payload, requestId } : { type, payload });
  }
}
