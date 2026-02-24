"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationGateway_1;
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const ws_1 = require("ws");
const ws_jwt_auth_service_1 = require("../../common/ws/ws-jwt-auth.service");
const notification_service_1 = require("../services/notification.service");
const client_updates_service_1 = require("../../client-updates/services/client-updates.service");
const version_utils_1 = require("../../common/utils/version.utils");
const ws_ticket_auth_service_1 = require("../../common/ws/ws-ticket-auth.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const social_relationship_entity_1 = require("../../social/entities/social-relationship.entity");
const admin_contact_service_1 = require("../services/admin-contact.service");
const user_badge_counts_service_1 = require("../services/user-badge-counts.service");
let NotificationGateway = NotificationGateway_1 = class NotificationGateway {
    auth;
    notifications;
    clientUpdates;
    wsTickets;
    adminContacts;
    counts;
    relationships;
    server;
    logger = new common_1.Logger(NotificationGateway_1.name);
    clients = new Map();
    socketCountsByUserId = new Map();
    constructor(auth, notifications, clientUpdates, wsTickets, adminContacts, counts, relationships) {
        this.auth = auth;
        this.notifications = notifications;
        this.clientUpdates = clientUpdates;
        this.wsTickets = wsTickets;
        this.adminContacts = adminContacts;
        this.counts = counts;
        this.relationships = relationships;
    }
    extractOriginFromWsArgs(args) {
        try {
            const request = (args && args[0]) || null;
            const headers = request?.headers || null;
            const hostHeader = headers?.['x-forwarded-host'] ||
                headers?.host ||
                '';
            const host = (hostHeader || '').split(',')[0]?.trim();
            if (!host)
                return null;
            const protoHeader = headers?.['x-forwarded-proto'] || 'https';
            const proto = (protoHeader || '').split(',')[0]?.trim() || 'https';
            return `${proto}://${host}`;
        }
        catch {
            return null;
        }
    }
    async handleConnection(client, ...args) {
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
            const minRequiredVersion = (await this.clientUpdates.getMinRequiredVersion())?.trim() || null;
            if (minRequiredVersion) {
                const outdated = !clientVersion ||
                    (0, version_utils_1.isVersionLower)(clientVersion, minRequiredVersion) === true;
                if (outdated) {
                    const origin = this.extractOriginFromWsArgs(args);
                    const latest = await this.clientUpdates.getLatest();
                    this.safeSend(client, {
                        type: 'client.update.required',
                        payload: {
                            minRequiredVersion,
                            currentVersion: clientVersion || null,
                            message: 'Une mise à jour du client est requise pour continuer.',
                            publishedAt: null,
                            url: this.clientUpdates.resolveClientPublicUrlForOrigin(latest, origin),
                        },
                    });
                    client.close(4406, 'update required');
                    return;
                }
            }
        }
        catch {
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
        try {
            const payload = await this.counts.getCounts(user.id);
            this.logger.log(`notify.counts initial push for user ${user.id}: ${JSON.stringify(payload)}`);
            this.safeSend(client, { type: 'notify.counts', payload });
        }
        catch {
            this.logger.warn(`notify.counts initial push failed for user ${user.id}; client will retry`);
            this.safeSend(client, {
                type: 'notify.counts',
                payload: { unreadNotifications: 0, unreadMessages: 0 },
            });
        }
    }
    handleDisconnect(client) {
        const meta = this.clients.get(client);
        this.clients.delete(client);
        if (meta) {
            this.notifications.unregister(meta.userId, client);
            const prevCount = this.socketCountsByUserId.get(meta.userId) ?? 0;
            const nextCount = Math.max(0, prevCount - 1);
            if (nextCount === 0) {
                this.socketCountsByUserId.delete(meta.userId);
                void this.notifyFriendsPresence(meta.userId, meta.username, false);
            }
            else {
                this.socketCountsByUserId.set(meta.userId, nextCount);
            }
        }
    }
    async notifyFriendsPresence(userId, username, isOnline) {
        if (!userId)
            return;
        try {
            const relations = await this.relationships.find({
                where: [
                    { requester: { id: userId }, status: 'accepted' },
                    { addressee: { id: userId }, status: 'accepted' },
                ],
            });
            const friendIds = relations
                .map((relation) => relation.requester?.id === userId
                ? relation.addressee?.id
                : relation.requester?.id)
                .filter((id) => typeof id === 'number' && id > 0 && id !== userId);
            if (friendIds.length === 0)
                return;
            const type = isOnline
                ? 'social.friend.connected'
                : 'social.friend.disconnected';
            const payload = {
                userId,
                username: String(username || '').trim() || `user#${userId}`,
            };
            this.logger.log(`Notify friends presence: user=${userId} ${isOnline ? 'online' : 'offline'} -> friends=${friendIds.join(',')}`);
            await Promise.all(friendIds.map((fid) => this.notifications.notifyUser(fid, type, payload)));
        }
        catch (err) {
            this.logger.debug('Friend notify failed', err);
        }
    }
    safeSend(client, payload) {
        if (client.readyState !== ws_1.WebSocket.OPEN)
            return;
        try {
            client.send(JSON.stringify(payload));
        }
        catch (err) {
            const type = payload &&
                typeof payload === 'object' &&
                typeof payload.type === 'string'
                ? payload.type
                : 'unknown';
            this.logger.warn(`Echec envoi WS notify (type=${type}) : ${err.message}`);
            try {
                client.close();
            }
            catch {
            }
        }
    }
    async onClientMessage(client, data) {
        const meta = this.clients.get(client);
        if (!meta) {
            return;
        }
        const raw = typeof data === 'string'
            ? data
            : data?.toString
                ? data.toString('utf-8')
                : '';
        if (!raw)
            return;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            return;
        }
        const type = typeof parsed?.type === 'string' ? parsed.type : '';
        if (!type)
            return;
        const requestId = typeof parsed?.requestId === 'string' ? parsed.requestId : null;
        if (type === 'notify.counts.get') {
            this.logger.log(`notify.counts.get received user=${meta.userId} requestId=${requestId ?? 'none'}`);
            try {
                const payload = await this.counts.getCounts(meta.userId);
                this.logger.log(`notify.counts.get for user ${meta.userId}: ${JSON.stringify(payload)}`);
                this.safeSendResponse(client, 'notify.counts', payload, requestId);
            }
            catch {
                this.logger.warn(`notify.counts.get failed for user ${meta.userId}, returning zeros`);
                this.safeSendResponse(client, 'notify.counts', { unreadNotifications: 0, unreadMessages: 0 }, requestId);
            }
            return;
        }
        if (type === 'notify.inbox.list') {
            try {
                const items = await this.adminContacts.listInbox(meta.userId, 200);
                this.safeSendResponse(client, 'notify.inbox.snapshot', { items }, requestId);
            }
            catch {
                this.safeSendResponse(client, 'notify.inbox.snapshot', { items: [] }, requestId);
            }
            return;
        }
        if (type === 'notify.inbox.delete') {
            const id = typeof parsed?.payload?.id === 'string' ? parsed.payload.id.trim() : '';
            if (!id)
                return;
            try {
                this.logger.log(`notify.inbox.delete user=${meta.userId} id=${id}`);
                await this.adminContacts.deleteInboxItem(meta.userId, id);
                const items = await this.adminContacts.listInbox(meta.userId, 200);
                const sampleIds = items
                    .slice(0, 5)
                    .map((it) => it.id)
                    .join(',');
                this.logger.log(`notify.inbox.snapshot after delete user=${meta.userId} count=${items.length} ids=[${sampleIds}]`);
                this.safeSendResponse(client, 'notify.inbox.snapshot', { items }, requestId);
            }
            catch {
            }
            return;
        }
        if (type === 'notify.inbox.markRead') {
            const id = typeof parsed?.payload?.id === 'string' ? parsed.payload.id.trim() : '';
            if (!id)
                return;
            try {
                await this.adminContacts.markRead(meta.userId, id);
                this.safeSendResponse(client, 'notify.inbox.markRead', { ok: true }, requestId);
            }
            catch {
            }
            return;
        }
        if (type === 'notify.admin_contact.send') {
            try {
                const message = typeof parsed?.payload?.message === 'string'
                    ? parsed.payload.message
                    : '';
                const item = await this.adminContacts.sendFromUserToStaff({
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles,
                }, message);
                this.safeSendResponse(client, 'notify.admin_contact.sent', { id: item.id, contactId: item.contactId }, requestId);
            }
            catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', { message: String(err?.message || 'Erreur') }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.reply') {
            try {
                const from = {
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles,
                };
                const message = typeof parsed?.payload?.message === 'string'
                    ? parsed.payload.message
                    : '';
                const contactId = typeof parsed?.payload?.contactId === 'string'
                    ? parsed.payload.contactId
                    : '';
                const toUserId = typeof parsed?.payload?.toUserId === 'number'
                    ? parsed.payload.toUserId
                    : 0;
                const isStaff = Array.isArray(from.roles) &&
                    (from.roles.includes('ROLE_ADMIN') ||
                        from.roles.includes('admin') ||
                        from.roles.includes('ROLE_MODERATOR') ||
                        from.roles.includes('moderator'));
                const item = isStaff
                    ? await this.adminContacts.replyFromStaffToUser(from, toUserId, message, contactId)
                    : await this.adminContacts.sendFromUserToStaff(from, message, contactId);
                this.safeSendResponse(client, 'notify.admin_contact.sent', { id: item.id, contactId: item.contactId }, requestId);
            }
            catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', { message: String(err?.message || 'Erreur') }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.setHandled') {
            try {
                const contactId = typeof parsed?.payload?.contactId === 'string'
                    ? parsed.payload.contactId
                    : '';
                const handled = Boolean(parsed?.payload?.handled);
                await this.adminContacts.setHandledForContact({
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles,
                }, contactId, handled);
                this.safeSendResponse(client, 'notify.admin_contact.setHandled', { ok: true }, requestId);
            }
            catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', { message: String(err?.message || 'Erreur') }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.setStatus') {
            try {
                const contactId = typeof parsed?.payload?.contactId === 'string'
                    ? parsed.payload.contactId
                    : '';
                const inboxItemId = typeof parsed?.payload?.id === 'string' ? parsed.payload.id : '';
                const status = typeof parsed?.payload?.status === 'string'
                    ? parsed.payload.status
                    : '';
                const from = {
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles,
                };
                if (contactId) {
                    await this.adminContacts.setStatusForContact(from, contactId, status);
                }
                else if (inboxItemId) {
                    await this.adminContacts.setStatusForInboxItem(from, meta.userId, inboxItemId, status);
                }
                else {
                    throw new Error('contactId ou id requis.');
                }
                this.safeSendResponse(client, 'notify.admin_contact.setStatus', { ok: true }, requestId);
            }
            catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', { message: String(err?.message || 'Erreur') }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.cycleStatus') {
            try {
                const contactId = typeof parsed?.payload?.contactId === 'string'
                    ? parsed.payload.contactId
                    : '';
                const inboxItemId = typeof parsed?.payload?.id === 'string' ? parsed.payload.id : '';
                const from = {
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles,
                };
                const res = contactId
                    ? await this.adminContacts.cycleStatusForContact(from, contactId)
                    : inboxItemId
                        ? await this.adminContacts.cycleStatusForInboxItem(from, meta.userId, inboxItemId)
                        : (() => {
                            throw new Error('contactId ou id requis.');
                        })();
                this.safeSendResponse(client, 'notify.admin_contact.cycleStatus', { ok: true, status: res.status }, requestId);
            }
            catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', { message: String(err?.message || 'Erreur') }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.threads') {
            try {
                const limitThreads = typeof parsed?.payload?.limit === 'number'
                    ? parsed.payload.limit
                    : undefined;
                const threads = await this.adminContacts.listThreads(meta.userId, {
                    limitThreads,
                });
                const sections = {
                    open: threads.filter((t) => t.status === 'open'),
                    in_progress: threads.filter((t) => t.status === 'in_progress'),
                    handled: threads.filter((t) => t.status === 'handled'),
                };
                this.safeSendResponse(client, 'notify.admin_contact.threads', {
                    sections: [
                        {
                            id: 'open',
                            title: 'Ouvert',
                            collapsed: true,
                            items: sections.open,
                        },
                        {
                            id: 'in_progress',
                            title: 'En cours',
                            collapsed: true,
                            items: sections.in_progress,
                        },
                        {
                            id: 'handled',
                            title: 'Traité',
                            collapsed: true,
                            items: sections.handled,
                        },
                    ],
                    total: threads.length,
                }, requestId);
            }
            catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', { message: String(err?.message || 'Erreur') }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.deleteThread') {
            try {
                const contactId = typeof parsed?.payload?.contactId === 'string'
                    ? parsed.payload.contactId
                    : '';
                await this.adminContacts.deleteThreadForContact({
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles,
                }, contactId);
                this.safeSendResponse(client, 'notify.admin_contact.deleteThread', { ok: true }, requestId);
            }
            catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', { message: String(err?.message || 'Erreur') }, requestId);
            }
            return;
        }
        if (type !== 'client.hello') {
            return;
        }
        const version = typeof parsed?.payload?.version === 'string'
            ? parsed.payload.version.trim()
            : '';
        if (!version)
            return;
        try {
            const latest = await this.clientUpdates.getLatest();
            const latestVersion = latest?.version?.trim();
            const minRequiredVersion = (await this.clientUpdates.getMinRequiredVersion())?.trim() || null;
            const url = this.clientUpdates.resolveClientPublicUrlForOrigin(latest, meta.origin);
            if (minRequiredVersion) {
                const required = (0, version_utils_1.isVersionLower)(version, minRequiredVersion);
                if (required === true) {
                    this.safeSend(client, {
                        type: 'client.update.required',
                        payload: {
                            minRequiredVersion,
                            currentVersion: version,
                            message: latest?.message ??
                                'Une mise à jour du client est requise pour continuer.',
                            publishedAt: latest?.publishedAt ?? null,
                            url,
                        },
                    });
                    try {
                        client.close(4406, 'update required');
                    }
                    catch {
                    }
                    return;
                }
            }
            if (latestVersion) {
                const available = (0, version_utils_1.isVersionGreater)(latestVersion, version);
                if (available === true) {
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
        }
        catch (err) {
            this.logger.debug('Echec vérification version client', err);
        }
    }
    safeSendResponse(client, type, payload, requestId) {
        this.safeSend(client, requestId ? { type, payload, requestId } : { type, payload });
    }
};
exports.NotificationGateway = NotificationGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", typeof (_a = typeof ws_1.Server !== "undefined" && ws_1.Server) === "function" ? _a : Object)
], NotificationGateway.prototype, "server", void 0);
exports.NotificationGateway = NotificationGateway = NotificationGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/ws/notify' }),
    __param(6, (0, typeorm_1.InjectRepository)(social_relationship_entity_1.SocialRelationship)),
    __metadata("design:paramtypes", [ws_jwt_auth_service_1.WsJwtAuthService,
        notification_service_1.NotificationService,
        client_updates_service_1.ClientUpdatesService,
        ws_ticket_auth_service_1.WsTicketAuthService,
        admin_contact_service_1.AdminContactService,
        user_badge_counts_service_1.UserBadgeCountsService,
        typeorm_2.Repository])
], NotificationGateway);
//# sourceMappingURL=notification.gateway.js.map