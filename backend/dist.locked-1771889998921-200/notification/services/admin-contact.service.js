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
var AdminContactService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminContactService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const notification_service_1 = require("./notification.service");
const user_entity_1 = require("../../user/entities/user.entity");
const notification_inbox_db_service_1 = require("./notification-inbox-db.service");
const user_badge_counts_service_1 = require("./user-badge-counts.service");
const string_value_utils_1 = require("../../common/utils/string-value.utils");
let AdminContactService = class AdminContactService {
    static { AdminContactService_1 = this; }
    notifications;
    inbox;
    counts;
    users;
    logger = new common_1.Logger(AdminContactService_1.name);
    static ADMIN_CONTACT_KIND = 'admin_contact';
    constructor(notifications, inbox, counts, users) {
        this.notifications = notifications;
        this.inbox = inbox;
        this.counts = counts;
        this.users = users;
    }
    isStaffRoles(roles) {
        const arr = Array.isArray(roles) ? roles.map((r) => String(r)) : [];
        return (arr.includes('ROLE_ADMIN') ||
            arr.includes('admin') ||
            arr.includes('ROLE_MODERATOR') ||
            arr.includes('moderator'));
    }
    async listStaffUserIds() {
        const all = await this.users.find({ select: ['id', 'username', 'roles'] });
        return all
            .filter((u) => this.isStaffRoles(u.roles))
            .map((u) => u.id)
            .filter((id) => typeof id === 'number' && id > 0);
    }
    static normalizeContactStatus(value) {
        const v = (0, string_value_utils_1.stringOrEmpty)(value).trim().toLowerCase();
        if (v === 'handled' || v === 'done' || v === 'resolved')
            return 'handled';
        if (v === 'in_progress' || v === 'in progress' || v === 'progress')
            return 'in_progress';
        return 'open';
    }
    static normalizeContactPayload(payload) {
        const obj = payload && typeof payload === 'object' ? payload : {};
        const normalizedStatus = AdminContactService_1.normalizeContactStatus(obj.status);
        const handled = normalizedStatus === 'handled' || Boolean(obj.handled);
        return {
            status: handled ? 'handled' : normalizedStatus,
            handled,
            statusAt: typeof obj.statusAt === 'string' ? obj.statusAt : null,
            statusByUserId: typeof obj.statusByUserId === 'number' ? obj.statusByUserId : null,
            statusByUsername: typeof obj.statusByUsername === 'string' ? obj.statusByUsername : null,
            handledAt: typeof obj.handledAt === 'string' ? obj.handledAt : null,
            handledByUserId: typeof obj.handledByUserId === 'number' ? obj.handledByUserId : null,
            handledByUsername: typeof obj.handledByUsername === 'string'
                ? obj.handledByUsername
                : null,
        };
    }
    async listInbox(userId, limit = 100) {
        const items = await this.inbox.list(userId, limit);
        return items.map((it) => {
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
                ...(it.payload ?? {}),
            };
            if (it.kind !== AdminContactService_1.ADMIN_CONTACT_KIND)
                return base;
            const normalized = AdminContactService_1.normalizeContactPayload(it.payload);
            return {
                ...base,
                status: normalized.status,
                handled: normalized.handled,
                statusAt: normalized.statusAt,
                statusByUserId: normalized.statusByUserId,
                statusByUsername: normalized.statusByUsername,
                handledAt: normalized.handledAt,
                handledByUserId: normalized.handledByUserId,
                handledByUsername: normalized.handledByUsername,
            };
        });
    }
    async listThreads(userId, { maxItems = 1000, limitThreads = 200, } = {}) {
        const items = await this.inbox.list(userId, maxItems);
        const threads = new Map();
        for (const it of items) {
            if (it.kind !== AdminContactService_1.ADMIN_CONTACT_KIND)
                continue;
            const contactId = it.contactId ?? '';
            if (!contactId)
                continue;
            const existing = threads.get(contactId);
            const unreadInc = it.readAt ? 0 : 1;
            if (!existing) {
                const normalized = AdminContactService_1.normalizeContactPayload(it.payload);
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
                    handledByUsername: normalized.handledByUsername,
                });
                continue;
            }
            existing.unreadCount += unreadInc;
        }
        return Array.from(threads.values()).slice(0, limitThreads);
    }
    async cycleStatusForContact(from, contactId) {
        if (!this.isStaffRoles(from.roles)) {
            throw new Error('Accès refusé.');
        }
        const cid = String(contactId || '').trim();
        if (!cid)
            throw new Error('contactId requis.');
        const rows = await this.inbox.listByContactId(AdminContactService_1.ADMIN_CONTACT_KIND, cid);
        if (rows.length === 0)
            return { status: 'open' };
        const current = AdminContactService_1.normalizeContactPayload(rows[0].payload);
        const next = current.status === 'open'
            ? 'in_progress'
            : current.status === 'in_progress'
                ? 'handled'
                : 'open';
        await this.setStatusForContact(from, cid, next);
        return { status: next };
    }
    async cycleStatusForInboxItem(from, userId, inboxItemId) {
        if (!this.isStaffRoles(from.roles)) {
            throw new Error('Accès refusé.');
        }
        const item = await this.inbox.getByIdForUser(userId, inboxItemId);
        const cid = item?.kind === AdminContactService_1.ADMIN_CONTACT_KIND
            ? (item.contactId ?? '')
            : '';
        if (!cid)
            throw new Error('contactId introuvable pour cette notification.');
        return this.cycleStatusForContact(from, cid);
    }
    async setStatusForInboxItem(from, userId, inboxItemId, status) {
        if (!this.isStaffRoles(from.roles)) {
            throw new Error('Accès refusé.');
        }
        const item = await this.inbox.getByIdForUser(userId, inboxItemId);
        const cid = item?.kind === AdminContactService_1.ADMIN_CONTACT_KIND
            ? (item.contactId ?? '')
            : '';
        if (!cid)
            throw new Error('contactId introuvable pour cette notification.');
        await this.setStatusForContact(from, cid, status);
    }
    async deleteInboxItem(userId, id) {
        const ok = await this.inbox.delete(userId, id);
        this.logger.log(`Inbox delete user=${userId} id=${id} ok=${ok}`);
        const items = await this.inbox.list(userId, 5);
        const ids = items.map((it) => it.id).join(',');
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
        const cid = contactId || (0, crypto_1.randomUUID)();
        const createdAt = new Date();
        const baseItem = {
            kind: 'admin_contact',
            contactId: cid,
            createdAt: createdAt.toISOString(),
            message: clean,
            fromUserId: from.id,
            fromUsername: from.username,
            status: 'open',
            handled: false,
        };
        const recipients = new Set([from.id, ...staffIds]);
        const firstRowId = (0, crypto_1.randomUUID)();
        const rowIds = Array.from(recipients).map((uid, i) => ({
            uid,
            rowId: i === 0 ? firstRowId : (0, crypto_1.randomUUID)(),
        }));
        await Promise.all(rowIds.map(async ({ uid, rowId }) => {
            const item = { ...baseItem, id: rowId };
            await this.inbox.create({
                id: rowId,
                userId: uid,
                kind: AdminContactService_1.ADMIN_CONTACT_KIND,
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
                    statusByUsername: null,
                },
            });
            try {
                await this.notifications.notifyUser(uid, 'notify.inbox.item', item);
            }
            catch (err) {
                this.logger.warn(`notify.inbox.item failed for user ${uid}: ${err.message}`);
            }
            try {
                await this.counts.notifyCounts(uid);
            }
            catch (err) {
                this.logger.warn(`notifyCounts failed for user ${uid}: ${err.message}`);
            }
        }));
        return { ...baseItem, id: firstRowId };
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
            handled: false,
        };
        const recipients = new Set([toUserId, ...staffIds]);
        const firstRowId = (0, crypto_1.randomUUID)();
        const rowIds = Array.from(recipients).map((uid, i) => ({
            uid,
            rowId: i === 0 ? firstRowId : (0, crypto_1.randomUUID)(),
        }));
        await Promise.all(rowIds.map(async ({ uid, rowId }) => {
            const item = { ...baseItem, id: rowId };
            await this.inbox.create({
                id: rowId,
                userId: uid,
                kind: AdminContactService_1.ADMIN_CONTACT_KIND,
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
                    statusByUsername: null,
                },
            });
            try {
                await this.notifications.notifyUser(uid, 'notify.inbox.item', item);
            }
            catch (err) {
                this.logger.warn(`notify.inbox.item failed for user ${uid}: ${err.message}`);
            }
            try {
                await this.counts.notifyCounts(uid);
            }
            catch (err) {
                this.logger.warn(`notifyCounts failed for user ${uid}: ${err.message}`);
            }
        }));
        return { ...baseItem, id: firstRowId };
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
        const normalizedStatus = AdminContactService_1.normalizeContactStatus(status);
        const rows = await this.inbox.listByContactId(AdminContactService_1.ADMIN_CONTACT_KIND, cid);
        if (rows.length === 0) {
            return;
        }
        const now = new Date();
        const isHandled = normalizedStatus === 'handled';
        await Promise.all(rows.map(async (row) => {
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
                handledByUsername: isHandled ? from.username : null,
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
                handledByUsername: nextPayload.handledByUsername,
            };
            try {
                await this.notifications.notifyUser(row.userId, 'notify.inbox.item', item);
            }
            catch (err) {
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
        for (const row of rows) {
            const list = byUser.get(row.userId) ?? [];
            list.push(row.id);
            byUser.set(row.userId, list);
        }
        await this.inbox.deleteManyByIds(rows.map((r) => r.id));
        await Promise.all(Array.from(byUser.entries()).map(async ([userId, ids]) => {
            try {
                await this.notifications.notifyUser(userId, 'notify.inbox.removed', {
                    ids,
                    contactId: cid,
                });
            }
            catch (err) {
                this.logger.warn(`notify.inbox.removed failed for user ${userId}: ${err.message}`);
            }
            try {
                await this.counts.notifyCounts(userId);
            }
            catch (err) {
                this.logger.warn(`notifyCounts failed for user ${userId}: ${err.message}`);
            }
        }));
    }
};
exports.AdminContactService = AdminContactService;
exports.AdminContactService = AdminContactService = AdminContactService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [notification_service_1.NotificationService,
        notification_inbox_db_service_1.NotificationInboxDbService,
        user_badge_counts_service_1.UserBadgeCountsService,
        typeorm_2.Repository])
], AdminContactService);
//# sourceMappingURL=admin-contact.service.js.map