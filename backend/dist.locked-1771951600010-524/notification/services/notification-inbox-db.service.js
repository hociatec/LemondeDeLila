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
var NotificationInboxDbService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationInboxDbService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_inbox_item_entity_1 = require("../entities/notification-inbox-item.entity");
let NotificationInboxDbService = NotificationInboxDbService_1 = class NotificationInboxDbService {
    repo;
    logger = new common_1.Logger(NotificationInboxDbService_1.name);
    constructor(repo) {
        this.repo = repo;
    }
    async create(input) {
        const entity = this.repo.create({
            id: input.id,
            user: { id: input.userId },
            kind: input.kind,
            contactId: input.contactId ?? null,
            fromUserId: input.fromUserId ?? null,
            fromUsername: input.fromUsername ?? null,
            toUserId: input.toUserId ?? null,
            message: input.message ?? null,
            payload: input.payload ?? null,
            createdAt: input.createdAt,
            readAt: null,
            deletedAt: null,
        });
        return this.repo.save(entity);
    }
    async list(userId, limit = 200) {
        const items = await this.repo.find({
            where: { user: { id: userId }, deletedAt: null },
            order: { createdAt: 'DESC' },
            take: limit,
        });
        return items.filter((it) => !it.deletedAt);
    }
    async getByIdForUser(userId, id) {
        const cleanId = String(id || '').trim();
        if (!cleanId)
            return null;
        return this.repo.findOne({
            where: { id: cleanId, user: { id: userId }, deletedAt: null },
        });
    }
    async markRead(userId, id) {
        const now = new Date();
        const res = await this.repo
            .createQueryBuilder()
            .update(notification_inbox_item_entity_1.NotificationInboxItem)
            .set({ readAt: now })
            .where('id = :id', { id })
            .andWhere('user_id = :userId', { userId })
            .andWhere('deleted_at IS NULL')
            .andWhere('read_at IS NULL')
            .execute();
        return (res.affected ?? 0) > 0;
    }
    async delete(userId, id) {
        const res = await this.repo
            .createQueryBuilder()
            .delete()
            .from(notification_inbox_item_entity_1.NotificationInboxItem)
            .where('id = :id', { id })
            .andWhere('user_id = :userId', { userId })
            .execute();
        if ((res.affected ?? 0) > 0)
            return true;
        const found = await this.repo.findOne({
            where: { id },
            select: { id: true, user: { id: true } },
            relations: ['user'],
            withDeleted: true,
        });
        if (found) {
            this.logger.warn(`Hard delete fallback user=${userId} id=${id} owner=${found.user?.id ?? 'none'}`);
            const res2 = await this.repo
                .createQueryBuilder()
                .delete()
                .from(notification_inbox_item_entity_1.NotificationInboxItem)
                .where('id = :id', { id })
                .execute();
            return (res2.affected ?? 0) > 0;
        }
        return false;
    }
    async countUnread(userId) {
        return this.repo.count({
            where: {
                user: { id: userId },
                deletedAt: null,
                readAt: null,
            },
        });
    }
    async listByContactId(kind, contactId) {
        const cleanKind = String(kind || '').trim();
        const cid = String(contactId || '').trim();
        if (!cleanKind || !cid)
            return [];
        try {
            const qb = this.repo
                .createQueryBuilder('it')
                .innerJoin('it.user', 'u')
                .select('it.id', 'id')
                .addSelect('u.id', 'userId')
                .addSelect('it.kind', 'kind')
                .addSelect('it.contactId', 'contactId')
                .addSelect('it.fromUserId', 'fromUserId')
                .addSelect('it.fromUsername', 'fromUsername')
                .addSelect('it.toUserId', 'toUserId')
                .addSelect('it.message', 'message')
                .addSelect('it.payload', 'payload')
                .addSelect('it.createdAt', 'createdAt')
                .addSelect('it.readAt', 'readAt')
                .where('it.kind = :kind', { kind: cleanKind })
                .andWhere('it.contactId = :contactId', { contactId: cid })
                .andWhere('it.deletedAt IS NULL');
            const rows = await qb.getRawMany();
            return rows
                .map((r) => ({
                id: String(r?.id ?? ''),
                userId: Number(r?.userId ?? 0),
                kind: String(r?.kind ?? ''),
                contactId: r?.contactId ? String(r.contactId) : null,
                fromUserId: r?.fromUserId == null ? null : Number(r.fromUserId),
                fromUsername: r?.fromUsername ? String(r.fromUsername) : null,
                toUserId: r?.toUserId == null ? null : Number(r.toUserId),
                message: r?.message ? String(r.message) : null,
                payload: r?.payload ?? null,
                createdAt: r?.createdAt ? new Date(r.createdAt) : new Date(),
                readAt: r?.readAt ? new Date(r.readAt) : null,
            }))
                .filter((r) => r.id && r.userId > 0);
        }
        catch (err) {
            this.logger.warn(`listByContactId failed kind=${kind} contactId=${contactId}: ${err.message}`);
            return [];
        }
    }
    async updatePayload(id, payload) {
        const clean = String(id || '').trim();
        if (!clean)
            return false;
        const res = await this.repo
            .createQueryBuilder()
            .update(notification_inbox_item_entity_1.NotificationInboxItem)
            .set({ payload: payload ?? null })
            .where('id = :id', { id: clean })
            .execute();
        return (res.affected ?? 0) > 0;
    }
    async deleteManyByIds(ids) {
        const clean = Array.from(new Set((ids ?? []).map((x) => String(x || '').trim()))).filter((x) => x);
        if (clean.length === 0)
            return 0;
        const res = await this.repo
            .createQueryBuilder()
            .delete()
            .from(notification_inbox_item_entity_1.NotificationInboxItem)
            .where('id IN (:...ids)', { ids: clean })
            .execute();
        return res.affected ?? 0;
    }
};
exports.NotificationInboxDbService = NotificationInboxDbService;
exports.NotificationInboxDbService = NotificationInboxDbService = NotificationInboxDbService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_inbox_item_entity_1.NotificationInboxItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], NotificationInboxDbService);
//# sourceMappingURL=notification-inbox-db.service.js.map