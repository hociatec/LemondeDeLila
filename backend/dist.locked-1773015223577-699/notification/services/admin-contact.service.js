"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminContactService", {
    enumerable: true,
    get: function() {
        return AdminContactService;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _crypto = require("crypto");
const _typeorm1 = require("typeorm");
const _notificationservice = require("./notification.service");
const _userentity = require("../../user/entities/user.entity");
const _notificationinboxdbservice = require("./notification-inbox-db.service");
const _userbadgecountsservice = require("./user-badge-counts.service");
const _stringvalueutils = require("../../common/utils/string-value.utils");
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
let AdminContactService = class AdminContactService {
    isStaffRoles(roles) {
        const arr = Array.isArray(roles) ? roles.map((r)=>String(r)) : [];
        return arr.includes('ROLE_ADMIN') || arr.includes('admin') || arr.includes('ROLE_MODERATOR') || arr.includes('moderator');
    }
    async listStaffUserIds() {
        const all = await this.users.find({
            select: [
                'id',
                'username',
                'roles'
            ]
        });
        return all.filter((u)=>this.isStaffRoles(u.roles)).map((u)=>u.id).filter((id)=>typeof id === 'number' && id > 0);
    }
    static normalizeContactStatus(value) {
        const v = (0, _stringvalueutils.stringOrEmpty)(value).trim().toLowerCase();
        if (v === 'handled' || v === 'done' || v === 'resolved') return 'handled';
        if (v === 'in_progress' || v === 'in progress' || v === 'progress') return 'in_progress';
        return 'open';
    }
    static normalizeContactPayload(payload) {
        const obj = payload && typeof payload === 'object' ? payload : {};
        const normalizedStatus = AdminContactService.normalizeContactStatus(obj.status);
        const handled = normalizedStatus === 'handled' || Boolean(obj.handled);
        return {
            status: handled ? 'handled' : normalizedStatus,
            handled,
            statusAt: typeof obj.statusAt === 'string' ? obj.statusAt : null,
            statusByUserId: typeof obj.statusByUserId === 'number' ? obj.statusByUserId : null,
            statusByUsername: typeof obj.statusByUsername === 'string' ? obj.statusByUsername : null,
            handledAt: typeof obj.handledAt === 'string' ? obj.handledAt : null,
            handledByUserId: typeof obj.handledByUserId === 'number' ? obj.handledByUserId : null,
            handledByUsername: typeof obj.handledByUsername === 'string' ? obj.handledByUsername : null
        };
    }
    async listInbox(userId, limit = 100) {
        const items = await this.inbox.list(userId, limit);
        return items.map((it)=>{
            const base = {
                id: it.id,
                kind: it.kind,
                contactId: it.contactId ?? null,
                createdAt: it.createdAt?.toISOString?.() ?? new Date().toISOString(),
                readAt: it.readAt?.toISOString?.() ?? null,
                fromUserId: it.fromUserId ?? 0,
                fromUsername: it.fromUsername ?? '',
                toUserId: it.toUserId ?? null,
                message: it.message ?? '',
                ...it.payload ?? {}
            };
            if (it.kind !== AdminContactService.ADMIN_CONTACT_KIND) return base;
            const normalized = AdminContactService.normalizeContactPayload(it.payload);
            return {
                ...base,
                status: normalized.status,
                handled: normalized.handled,
                statusAt: normalized.statusAt,
                statusByUserId: normalized.statusByUserId,
                statusByUsername: normalized.statusByUsername,
                handledAt: normalized.handledAt,
                handledByUserId: normalized.handledByUserId,
                handledByUsername: normalized.handledByUsername
            };
        });
    }
    async listThreads(userId, { maxItems = 1000, limitThreads = 200 } = {}) {
        const items = await this.inbox.list(userId, maxItems);
        const threads = new Map();
        for (const it of items){
            if (it.kind !== AdminContactService.ADMIN_CONTACT_KIND) continue;
            const contactId = it.contactId ?? '';
            if (!contactId) continue;
            const existing = threads.get(contactId);
            const unreadInc = it.readAt ? 0 : 1;
            if (!existing) {
                const normalized = AdminContactService.normalizeContactPayload(it.payload);
                threads.set(contactId, {
                    kind: 'admin_contact',
                    contactId,
                    latestId: it.id,
                    latestCreatedAt: it.createdAt?.toISOString?.() ?? new Date().toISOString(),
                    latestReadAt: it.readAt?.toISOString?.() ?? null,
                    latestMessage: it.message ?? '',
                    fromUserId: it.fromUserId ?? 0,
                    fromUsername: it.fromUsername ?? '',
                    toUserId: it.toUserId ?? null,
                    unreadCount: unreadInc,
                    status: normalized.status,
                    handled: normalized.handled,
                    statusAt: normalized.statusAt,
                    statusByUserId: normalized.statusByUserId,
                    statusByUsername: normalized.statusByUsername,
                    handledAt: normalized.handledAt,
                    handledByUserId: normalized.handledByUserId,
                    handledByUsername: normalized.handledByUsername
                });
                continue;
            }
            existing.unreadCount += unreadInc;
        // Items are already sorted by createdAt DESC, so the first entry for a contactId is the latest.
        }
        return Array.from(threads.values()).slice(0, limitThreads);
    }
    async cycleStatusForContact(from, contactId) {
        if (!this.isStaffRoles(from.roles)) {
            throw new Error('Accès refusé.');
        }
        const cid = String(contactId || '').trim();
        if (!cid) throw new Error('contactId requis.');
        const rows = await this.inbox.listByContactId(AdminContactService.ADMIN_CONTACT_KIND, cid);
        if (rows.length === 0) return {
            status: 'open'
        };
        const current = AdminContactService.normalizeContactPayload(rows[0].payload);
        const next = current.status === 'open' ? 'in_progress' : current.status === 'in_progress' ? 'handled' : 'open';
        await this.setStatusForContact(from, cid, next);
        return {
            status: next
        };
    }
    async cycleStatusForInboxItem(from, userId, inboxItemId) {
        if (!this.isStaffRoles(from.roles)) {
            throw new Error('Accès refusé.');
        }
        const item = await this.inbox.getByIdForUser(userId, inboxItemId);
        const cid = item?.kind === AdminContactService.ADMIN_CONTACT_KIND ? item.contactId ?? '' : '';
        if (!cid) throw new Error('contactId introuvable pour cette notification.');
        return this.cycleStatusForContact(from, cid);
    }
    async setStatusForInboxItem(from, userId, inboxItemId, status) {
        if (!this.isStaffRoles(from.roles)) {
            throw new Error('Accès refusé.');
        }
        const item = await this.inbox.getByIdForUser(userId, inboxItemId);
        const cid = item?.kind === AdminContactService.ADMIN_CONTACT_KIND ? item.contactId ?? '' : '';
        if (!cid) throw new Error('contactId introuvable pour cette notification.');
        await this.setStatusForContact(from, cid, status);
    }
    async deleteInboxItem(userId, id) {
        const ok = await this.inbox.delete(userId, id);
        this.logger.log(`Inbox delete user=${userId} id=${id} ok=${ok}`);
        const items = await this.inbox.list(userId, 5);
        const ids = items.map((it)=>it.id).join(',');
        this.logger.log(`Inbox after delete user=${userId} remaining=${items.length} ids=[${ids}]`);
        await this.counts.notifyCounts(userId);
    }
    async markRead(userId, id) {
        await this.inbox.markRead(userId, id);
        await this.counts.notifyCounts(userId);
    }
    async sendFromUserToStaff(from, message, contactId) {
        const clean = String(message || '').trim();
        if (!clean) {
            throw new Error('Message vide.');
        }
        if (clean.length > 2000) {
            throw new Error('Message trop long (max 2000 caractères).');
        }
        const staffIds = await this.listStaffUserIds();
        const cid = contactId || (0, _crypto.randomUUID)();
        const createdAt = new Date();
        const baseItem = {
            kind: 'admin_contact',
            contactId: cid,
            createdAt: createdAt.toISOString(),
            message: clean,
            fromUserId: from.id,
            fromUsername: from.username,
            status: 'open',
            handled: false
        };
        const recipients = new Set([
            from.id,
            ...staffIds
        ]);
        const firstRowId = (0, _crypto.randomUUID)();
        const rowIds = Array.from(recipients).map((uid, i)=>({
                uid,
                rowId: i === 0 ? firstRowId : (0, _crypto.randomUUID)()
            }));
        await Promise.all(rowIds.map(async ({ uid, rowId })=>{
            const item = {
                ...baseItem,
                id: rowId
            };
            await this.inbox.create({
                id: rowId,
                userId: uid,
                kind: AdminContactService.ADMIN_CONTACT_KIND,
                createdAt,
                contactId: cid,
                fromUserId: from.id,
                fromUsername: from.username,
                toUserId: null,
                message: clean,
                payload: {
                    status: 'open',
                    handled: false,
                    statusAt: null,
                    statusByUserId: null,
                    statusByUsername: null
                }
            });
            try {
                await this.notifications.notifyUser(uid, 'notify.inbox.item', item);
            } catch (err) {
                this.logger.warn(`notify.inbox.item failed for user ${uid}: ${err.message}`);
            }
            try {
                await this.counts.notifyCounts(uid);
            } catch (err) {
                this.logger.warn(`notifyCounts failed for user ${uid}: ${err.message}`);
            }
        }));
        return {
            ...baseItem,
            id: firstRowId
        };
    }
    async replyFromStaffToUser(from, toUserId, message, contactId) {
        if (!this.isStaffRoles(from.roles)) {
            throw new Error('Accès refusé.');
        }
        if (!toUserId || toUserId <= 0) {
            throw new Error('Destinataire invalide.');
        }
        const clean = String(message || '').trim();
        if (!clean) {
            throw new Error('Message vide.');
        }
        if (clean.length > 2000) {
            throw new Error('Message trop long (max 2000 caractères).');
        }
        const cid = String(contactId || '').trim();
        if (!cid) {
            throw new Error('contactId requis.');
        }
        const staffIds = await this.listStaffUserIds();
        const createdAt = new Date();
        const baseItem = {
            kind: 'admin_contact',
            contactId: cid,
            createdAt: createdAt.toISOString(),
            message: clean,
            fromUserId: from.id,
            fromUsername: from.username,
            toUserId,
            status: 'open',
            handled: false
        };
        const recipients = new Set([
            toUserId,
            ...staffIds
        ]);
        const firstRowId = (0, _crypto.randomUUID)();
        const rowIds = Array.from(recipients).map((uid, i)=>({
                uid,
                rowId: i === 0 ? firstRowId : (0, _crypto.randomUUID)()
            }));
        await Promise.all(rowIds.map(async ({ uid, rowId })=>{
            const item = {
                ...baseItem,
                id: rowId
            };
            await this.inbox.create({
                id: rowId,
                userId: uid,
                kind: AdminContactService.ADMIN_CONTACT_KIND,
                createdAt,
                contactId: cid,
                fromUserId: from.id,
                fromUsername: from.username,
                toUserId,
                message: clean,
                payload: {
                    status: 'open',
                    handled: false,
                    statusAt: null,
                    statusByUserId: null,
                    statusByUsername: null
                }
            });
            try {
                await this.notifications.notifyUser(uid, 'notify.inbox.item', item);
            } catch (err) {
                this.logger.warn(`notify.inbox.item failed for user ${uid}: ${err.message}`);
            }
            try {
                await this.counts.notifyCounts(uid);
            } catch (err) {
                this.logger.warn(`notifyCounts failed for user ${uid}: ${err.message}`);
            }
        }));
        return {
            ...baseItem,
            id: firstRowId
        };
    }
    async setHandledForContact(from, contactId, handled) {
        await this.setStatusForContact(from, contactId, handled ? 'handled' : 'open');
    }
    async setStatusForContact(from, contactId, status) {
        if (!this.isStaffRoles(from.roles)) {
            throw new Error('Accès refusé.');
        }
        const cid = String(contactId || '').trim();
        if (!cid) {
            throw new Error('contactId requis.');
        }
        const normalizedStatus = AdminContactService.normalizeContactStatus(status);
        const rows = await this.inbox.listByContactId(AdminContactService.ADMIN_CONTACT_KIND, cid);
        if (rows.length === 0) {
            return;
        }
        const now = new Date();
        const isHandled = normalizedStatus === 'handled';
        await Promise.all(rows.map(async (row)=>{
            const prev = row.payload && typeof row.payload === 'object' ? row.payload : {};
            const nextPayload = {
                ...prev,
                status: normalizedStatus,
                handled: isHandled,
                statusAt: now.toISOString(),
                statusByUserId: from.id,
                statusByUsername: from.username,
                handledAt: isHandled ? now.toISOString() : null,
                handledByUserId: isHandled ? from.id : null,
                handledByUsername: isHandled ? from.username : null
            };
            await this.inbox.updatePayload(row.id, nextPayload);
            const item = {
                kind: 'admin_contact',
                id: row.id,
                contactId: cid,
                createdAt: row.createdAt.toISOString(),
                readAt: row.readAt?.toISOString?.() ?? null,
                fromUserId: row.fromUserId ?? 0,
                fromUsername: row.fromUsername ?? '',
                toUserId: row.toUserId ?? undefined,
                message: row.message ?? '',
                status: normalizedStatus,
                handled: isHandled,
                statusAt: nextPayload.statusAt,
                statusByUserId: nextPayload.statusByUserId,
                statusByUsername: nextPayload.statusByUsername,
                handledAt: nextPayload.handledAt,
                handledByUserId: nextPayload.handledByUserId,
                handledByUsername: nextPayload.handledByUsername
            };
            try {
                await this.notifications.notifyUser(row.userId, 'notify.inbox.item', item);
            } catch (err) {
                this.logger.warn(`notify.inbox.item failed for user ${row.userId}: ${err.message}`);
            }
        }));
    }
    async deleteThreadForContact(from, contactId) {
        if (!this.isStaffRoles(from.roles)) {
            throw new Error('Accès refusé.');
        }
        const cid = String(contactId || '').trim();
        if (!cid) {
            throw new Error('contactId requis.');
        }
        const rows = await this.inbox.listByContactId('admin_contact', cid);
        if (rows.length === 0) {
            return;
        }
        const byUser = new Map();
        for (const row of rows){
            const list = byUser.get(row.userId) ?? [];
            list.push(row.id);
            byUser.set(row.userId, list);
        }
        await this.inbox.deleteManyByIds(rows.map((r)=>r.id));
        await Promise.all(Array.from(byUser.entries()).map(async ([userId, ids])=>{
            try {
                await this.notifications.notifyUser(userId, 'notify.inbox.removed', {
                    ids,
                    contactId: cid
                });
            } catch (err) {
                this.logger.warn(`notify.inbox.removed failed for user ${userId}: ${err.message}`);
            }
            try {
                await this.counts.notifyCounts(userId);
            } catch (err) {
                this.logger.warn(`notifyCounts failed for user ${userId}: ${err.message}`);
            }
        }));
    }
    constructor(notifications, inbox, counts, users){
        this.notifications = notifications;
        this.inbox = inbox;
        this.counts = counts;
        this.users = users;
        this.logger = new _common.Logger(AdminContactService.name);
    }
};
AdminContactService.ADMIN_CONTACT_KIND = 'admin_contact';
AdminContactService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(3, (0, _typeorm.InjectRepository)(_userentity.User)),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _notificationservice.NotificationService === "undefined" ? Object : _notificationservice.NotificationService,
        typeof _notificationinboxdbservice.NotificationInboxDbService === "undefined" ? Object : _notificationinboxdbservice.NotificationInboxDbService,
        typeof _userbadgecountsservice.UserBadgeCountsService === "undefined" ? Object : _userbadgecountsservice.UserBadgeCountsService,
        typeof _typeorm1.Repository === "undefined" ? Object : _typeorm1.Repository
    ])
], AdminContactService);
