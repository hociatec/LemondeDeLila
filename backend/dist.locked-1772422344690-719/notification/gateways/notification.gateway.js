"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NotificationGateway", {
    enumerable: true,
    get: function() {
        return NotificationGateway;
    }
});
const _common = require("@nestjs/common");
const _websockets = require("@nestjs/websockets");
const _ws = require("ws");
const _wsjwtauthservice = require("../../common/ws/ws-jwt-auth.service");
const _notificationservice = require("../services/notification.service");
const _clientupdatesservice = require("../../client-updates/services/client-updates.service");
const _versionutils = require("../../common/utils/version.utils");
const _wsticketauthservice = require("../../common/ws/ws-ticket-auth.service");
const _typeorm = require("@nestjs/typeorm");
const _typeorm1 = require("typeorm");
const _socialrelationshipentity = require("../../social/entities/social-relationship.entity");
const _admincontactservice = require("../services/admin-contact.service");
const _userbadgecountsservice = require("../services/user-badge-counts.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let NotificationGateway = class NotificationGateway {
    extractOriginFromWsArgs(args) {
        try {
            const request = args && args[0] || null;
            const headers = request?.headers || null;
            const hostHeader = headers?.['x-forwarded-host'] || headers?.host || '';
            const host = (hostHeader || '').split(',')[0]?.trim();
            if (!host) return null;
            const protoHeader = headers?.['x-forwarded-proto'] || 'https';
            const proto = (protoHeader || '').split(',')[0]?.trim() || 'https';
            return `${proto}://${host}`;
        } catch  {
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
        // Best-effort "early" enforcement: if the client is already below the required version,
        // tell them immediately (no need to wait for client.hello).
        try {
            const clientVersion = this.auth.extractClientVersion(client, args);
            const minRequiredVersion = (await this.clientUpdates.getMinRequiredVersion())?.trim() || null;
            if (minRequiredVersion) {
                const outdated = !clientVersion || (0, _versionutils.isVersionLower)(clientVersion, minRequiredVersion) === true;
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
                            url: this.clientUpdates.resolveClientPublicUrlForOrigin(latest, origin)
                        }
                    });
                    await new Promise((resolve)=>setTimeout(resolve, 300));
                    client.close(4406, 'update required');
                    return;
                }
            }
        } catch  {
        // ignore
        }
        const prevCount = this.socketCountsByUserId.get(user.id) ?? 0;
        this.clients.set(client, {
            userId: user.id,
            username: String(user.username || '').trim() || `user#${user.id}`,
            roles: Array.isArray(user.roles) ? user.roles : [],
            socket: client,
            origin: this.extractOriginFromWsArgs(args)
        });
        this.notifications.register(user.id, client);
        this.socketCountsByUserId.set(user.id, prevCount + 1);
        if (prevCount === 0) {
            void this.notifyFriendsPresence(user.id, user.username, true);
        }
        client.on('error', ()=>client.close());
        client.on('message', (data)=>this.onClientMessage(client, data));
        this.safeSend(client, {
            type: 'notify.connected',
            payload: {
                userId: user.id
            }
        });
        // Push counts at connect (source of truth for badges).
        try {
            const payload = await this.counts.getCounts(user.id);
            this.logger.log(`notify.counts initial push for user ${user.id}: ${JSON.stringify(payload)}`);
            this.safeSend(client, {
                type: 'notify.counts',
                payload
            });
        } catch  {
            this.logger.warn(`notify.counts initial push failed for user ${user.id}; client will retry`);
            // Even on failure, send zeros to avoid client timeouts.
            this.safeSend(client, {
                type: 'notify.counts',
                payload: {
                    unreadNotifications: 0,
                    unreadMessages: 0
                }
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
            } else {
                this.socketCountsByUserId.set(meta.userId, nextCount);
            }
        }
    }
    async notifyFriendsPresence(userId, username, isOnline) {
        if (!userId) return;
        try {
            const relations = await this.relationships.find({
                where: [
                    {
                        requester: {
                            id: userId
                        },
                        status: 'accepted'
                    },
                    {
                        addressee: {
                            id: userId
                        },
                        status: 'accepted'
                    }
                ]
            });
            const friendIds = relations.map((relation)=>relation.requester?.id === userId ? relation.addressee?.id : relation.requester?.id).filter((id)=>typeof id === 'number' && id > 0 && id !== userId);
            if (friendIds.length === 0) return;
            const type = isOnline ? 'social.friend.connected' : 'social.friend.disconnected';
            const payload = {
                userId,
                username: String(username || '').trim() || `user#${userId}`
            };
            this.logger.log(`Notify friends presence: user=${userId} ${isOnline ? 'online' : 'offline'} -> friends=${friendIds.join(',')}`);
            await Promise.all(friendIds.map((fid)=>this.notifications.notifyUser(fid, type, payload)));
        } catch (err) {
            this.logger.debug('Friend notify failed', err);
        }
    }
    safeSend(client, payload) {
        if (client.readyState !== _ws.WebSocket.OPEN) return;
        try {
            client.send(JSON.stringify(payload));
        } catch (err) {
            const type = payload && typeof payload === 'object' && typeof payload.type === 'string' ? payload.type : 'unknown';
            this.logger.warn(`Echec envoi WS notify (type=${type}) : ${err.message}`);
            try {
                client.close();
            } catch  {
            /* ignore */ }
        }
    }
    async onClientMessage(client, data) {
        const meta = this.clients.get(client);
        if (!meta) {
            return;
        }
        const raw = typeof data === 'string' ? data : data?.toString ? data.toString('utf-8') : '';
        if (!raw) return;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch  {
            return;
        }
        const type = typeof parsed?.type === 'string' ? parsed.type : '';
        if (!type) return;
        const requestId = typeof parsed?.requestId === 'string' ? parsed.requestId : null;
        if (type === 'notify.counts.get') {
            this.logger.log(`notify.counts.get received user=${meta.userId} requestId=${requestId ?? 'none'}`);
            try {
                const payload = await this.counts.getCounts(meta.userId);
                this.logger.log(`notify.counts.get for user ${meta.userId}: ${JSON.stringify(payload)}`);
                this.safeSendResponse(client, 'notify.counts', payload, requestId);
            } catch  {
                this.logger.warn(`notify.counts.get failed for user ${meta.userId}, returning zeros`);
                this.safeSendResponse(client, 'notify.counts', {
                    unreadNotifications: 0,
                    unreadMessages: 0
                }, requestId);
            }
            return;
        }
        if (type === 'notify.inbox.list') {
            try {
                const items = await this.adminContacts.listInbox(meta.userId, 200);
                this.safeSendResponse(client, 'notify.inbox.snapshot', {
                    items
                }, requestId);
            } catch  {
                this.safeSendResponse(client, 'notify.inbox.snapshot', {
                    items: []
                }, requestId);
            }
            return;
        }
        if (type === 'notify.inbox.delete') {
            const id = typeof parsed?.payload?.id === 'string' ? parsed.payload.id.trim() : '';
            if (!id) return;
            try {
                this.logger.log(`notify.inbox.delete user=${meta.userId} id=${id}`);
                await this.adminContacts.deleteInboxItem(meta.userId, id);
                const items = await this.adminContacts.listInbox(meta.userId, 200);
                const sampleIds = items.slice(0, 5).map((it)=>it.id).join(',');
                this.logger.log(`notify.inbox.snapshot after delete user=${meta.userId} count=${items.length} ids=[${sampleIds}]`);
                this.safeSendResponse(client, 'notify.inbox.snapshot', {
                    items
                }, requestId);
            } catch  {
            // ignore
            }
            return;
        }
        if (type === 'notify.inbox.markRead') {
            const id = typeof parsed?.payload?.id === 'string' ? parsed.payload.id.trim() : '';
            if (!id) return;
            try {
                await this.adminContacts.markRead(meta.userId, id);
                this.safeSendResponse(client, 'notify.inbox.markRead', {
                    ok: true
                }, requestId);
            } catch  {
            // ignore
            }
            return;
        }
        if (type === 'notify.admin_contact.send') {
            try {
                const message = typeof parsed?.payload?.message === 'string' ? parsed.payload.message : '';
                const item = await this.adminContacts.sendFromUserToStaff({
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles
                }, message);
                this.safeSendResponse(client, 'notify.admin_contact.sent', {
                    id: item.id,
                    contactId: item.contactId
                }, requestId);
            } catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', {
                    message: String(err?.message || 'Erreur')
                }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.reply') {
            try {
                const from = {
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles
                };
                const message = typeof parsed?.payload?.message === 'string' ? parsed.payload.message : '';
                const contactId = typeof parsed?.payload?.contactId === 'string' ? parsed.payload.contactId : '';
                const toUserId = typeof parsed?.payload?.toUserId === 'number' ? parsed.payload.toUserId : 0;
                const isStaff = Array.isArray(from.roles) && (from.roles.includes('ROLE_ADMIN') || from.roles.includes('admin') || from.roles.includes('ROLE_MODERATOR') || from.roles.includes('moderator'));
                const item = isStaff ? await this.adminContacts.replyFromStaffToUser(from, toUserId, message, contactId) : await this.adminContacts.sendFromUserToStaff(from, message, contactId);
                this.safeSendResponse(client, 'notify.admin_contact.sent', {
                    id: item.id,
                    contactId: item.contactId
                }, requestId);
            } catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', {
                    message: String(err?.message || 'Erreur')
                }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.setHandled') {
            try {
                const contactId = typeof parsed?.payload?.contactId === 'string' ? parsed.payload.contactId : '';
                const handled = Boolean(parsed?.payload?.handled);
                await this.adminContacts.setHandledForContact({
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles
                }, contactId, handled);
                this.safeSendResponse(client, 'notify.admin_contact.setHandled', {
                    ok: true
                }, requestId);
            } catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', {
                    message: String(err?.message || 'Erreur')
                }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.setStatus') {
            try {
                const contactId = typeof parsed?.payload?.contactId === 'string' ? parsed.payload.contactId : '';
                const inboxItemId = typeof parsed?.payload?.id === 'string' ? parsed.payload.id : '';
                const status = typeof parsed?.payload?.status === 'string' ? parsed.payload.status : '';
                const from = {
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles
                };
                if (contactId) {
                    await this.adminContacts.setStatusForContact(from, contactId, status);
                } else if (inboxItemId) {
                    await this.adminContacts.setStatusForInboxItem(from, meta.userId, inboxItemId, status);
                } else {
                    throw new Error('contactId ou id requis.');
                }
                this.safeSendResponse(client, 'notify.admin_contact.setStatus', {
                    ok: true
                }, requestId);
            } catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', {
                    message: String(err?.message || 'Erreur')
                }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.cycleStatus') {
            try {
                const contactId = typeof parsed?.payload?.contactId === 'string' ? parsed.payload.contactId : '';
                const inboxItemId = typeof parsed?.payload?.id === 'string' ? parsed.payload.id : '';
                const from = {
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles
                };
                const res = contactId ? await this.adminContacts.cycleStatusForContact(from, contactId) : inboxItemId ? await this.adminContacts.cycleStatusForInboxItem(from, meta.userId, inboxItemId) : (()=>{
                    throw new Error('contactId ou id requis.');
                })();
                this.safeSendResponse(client, 'notify.admin_contact.cycleStatus', {
                    ok: true,
                    status: res.status
                }, requestId);
            } catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', {
                    message: String(err?.message || 'Erreur')
                }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.threads') {
            try {
                const limitThreads = typeof parsed?.payload?.limit === 'number' ? parsed.payload.limit : undefined;
                const threads = await this.adminContacts.listThreads(meta.userId, {
                    limitThreads
                });
                const sections = {
                    open: threads.filter((t)=>t.status === 'open'),
                    in_progress: threads.filter((t)=>t.status === 'in_progress'),
                    handled: threads.filter((t)=>t.status === 'handled')
                };
                this.safeSendResponse(client, 'notify.admin_contact.threads', {
                    sections: [
                        {
                            id: 'open',
                            title: 'Ouvert',
                            collapsed: true,
                            items: sections.open
                        },
                        {
                            id: 'in_progress',
                            title: 'En cours',
                            collapsed: true,
                            items: sections.in_progress
                        },
                        {
                            id: 'handled',
                            title: 'Traité',
                            collapsed: true,
                            items: sections.handled
                        }
                    ],
                    total: threads.length
                }, requestId);
            } catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', {
                    message: String(err?.message || 'Erreur')
                }, requestId);
            }
            return;
        }
        if (type === 'notify.admin_contact.deleteThread') {
            try {
                const contactId = typeof parsed?.payload?.contactId === 'string' ? parsed.payload.contactId : '';
                await this.adminContacts.deleteThreadForContact({
                    id: meta.userId,
                    username: meta.username,
                    roles: meta.roles
                }, contactId);
                this.safeSendResponse(client, 'notify.admin_contact.deleteThread', {
                    ok: true
                }, requestId);
            } catch (err) {
                this.safeSendResponse(client, 'notify.admin_contact.error', {
                    message: String(err?.message || 'Erreur')
                }, requestId);
            }
            return;
        }
        if (type !== 'client.hello') {
            return;
        }
        const version = typeof parsed?.payload?.version === 'string' ? parsed.payload.version.trim() : '';
        if (!version) return;
        try {
            const latest = await this.clientUpdates.getLatest();
            const latestVersion = latest?.version?.trim();
            const minRequiredVersion = (await this.clientUpdates.getMinRequiredVersion())?.trim() || null;
            const url = this.clientUpdates.resolveClientPublicUrlForOrigin(latest, meta.origin);
            if (minRequiredVersion) {
                const required = (0, _versionutils.isVersionLower)(version, minRequiredVersion);
                if (required === true) {
                    this.safeSend(client, {
                        type: 'client.update.required',
                        payload: {
                            minRequiredVersion,
                            currentVersion: version,
                            message: latest?.message ?? 'Une mise à jour du client est requise pour continuer.',
                            publishedAt: latest?.publishedAt ?? null,
                            url
                        }
                    });
                    await new Promise((resolve)=>setTimeout(resolve, 300));
                    try {
                        client.close(4406, 'update required');
                    } catch  {
                    /* ignore */ }
                    return;
                }
            }
            if (latestVersion) {
                const available = (0, _versionutils.isVersionGreater)(latestVersion, version);
                if (available === true) {
                    // Send directly to this socket (no broadcast) to avoid duplicates across instances.
                    this.safeSend(client, {
                        type: 'client.update.available',
                        payload: {
                            version: latestVersion,
                            message: latest?.message ?? null,
                            publishedAt: latest?.publishedAt ?? null,
                            url
                        }
                    });
                }
            }
        } catch (err) {
            this.logger.debug('Echec vérification version client', err);
        }
    }
    safeSendResponse(client, type, payload, requestId) {
        this.safeSend(client, requestId ? {
            type,
            payload,
            requestId
        } : {
            type,
            payload
        });
    }
    constructor(auth, notifications, clientUpdates, wsTickets, adminContacts, counts, relationships){
        this.auth = auth;
        this.notifications = notifications;
        this.clientUpdates = clientUpdates;
        this.wsTickets = wsTickets;
        this.adminContacts = adminContacts;
        this.counts = counts;
        this.relationships = relationships;
        this.logger = new _common.Logger(NotificationGateway.name);
        this.clients = new Map();
        this.socketCountsByUserId = new Map();
    }
};
_ts_decorate([
    (0, _websockets.WebSocketServer)(),
    _ts_metadata("design:type", typeof _ws.Server === "undefined" ? Object : _ws.Server)
], NotificationGateway.prototype, "server", void 0);
NotificationGateway = _ts_decorate([
    (0, _websockets.WebSocketGateway)({
        path: '/ws/notify'
    }),
    _ts_param(6, (0, _typeorm.InjectRepository)(_socialrelationshipentity.SocialRelationship)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsjwtauthservice.WsJwtAuthService === "undefined" ? Object : _wsjwtauthservice.WsJwtAuthService,
        typeof _notificationservice.NotificationService === "undefined" ? Object : _notificationservice.NotificationService,
        typeof _clientupdatesservice.ClientUpdatesService === "undefined" ? Object : _clientupdatesservice.ClientUpdatesService,
        typeof _wsticketauthservice.WsTicketAuthService === "undefined" ? Object : _wsticketauthservice.WsTicketAuthService,
        typeof _admincontactservice.AdminContactService === "undefined" ? Object : _admincontactservice.AdminContactService,
        typeof _userbadgecountsservice.UserBadgeCountsService === "undefined" ? Object : _userbadgecountsservice.UserBadgeCountsService,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], NotificationGateway);
