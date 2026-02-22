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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_service_1 = require("../../notification/services/notification.service");
const user_entity_1 = require("../../user/entities/user.entity");
const social_profile_settings_service_1 = require("./social-profile-settings.service");
const social_profile_entity_1 = require("../entities/social-profile.entity");
const social_relationship_entity_1 = require("../entities/social-relationship.entity");
const PROFILE_VISIBILITY = [
    'public',
    'friends',
    'private',
];
let SocialService = class SocialService {
    relationships;
    profiles;
    users;
    notifications;
    profileSettings;
    constructor(relationships, profiles, users, notifications, profileSettings) {
        this.relationships = relationships;
        this.profiles = profiles;
        this.users = users;
        this.notifications = notifications;
        this.profileSettings = profileSettings;
    }
    async listFriends(userId) {
        const relations = await this.relationships.find({
            where: [
                { requester: { id: userId }, status: 'accepted' },
                { addressee: { id: userId }, status: 'accepted' },
            ],
            order: { updatedAt: 'DESC' },
        });
        return relations.map((relation) => {
            const friend = relation.requester.id === userId
                ? relation.addressee
                : relation.requester;
            return {
                id: friend.id,
                username: friend.username,
                avatar: friend.avatar ?? null,
                since: relation.updatedAt,
            };
        });
    }
    async listRequests(userId, direction) {
        const where = direction === 'incoming'
            ? { addressee: { id: userId }, status: 'pending' }
            : direction === 'outgoing'
                ? { requester: { id: userId }, status: 'pending' }
                : [
                    { addressee: { id: userId }, status: 'pending' },
                    { requester: { id: userId }, status: 'pending' },
                ];
        const relations = await this.relationships.find({
            where: where,
            order: { createdAt: 'DESC' },
        });
        return relations.map((relation) => ({
            id: relation.id,
            requester: {
                id: relation.requester.id,
                username: relation.requester.username,
                avatar: relation.requester.avatar ?? null,
            },
            addressee: {
                id: relation.addressee.id,
                username: relation.addressee.username,
                avatar: relation.addressee.avatar ?? null,
            },
            createdAt: relation.createdAt,
        }));
    }
    async listBlocked(userId) {
        const relations = await this.relationships.find({
            where: { requester: { id: userId }, status: 'blocked' },
            order: { updatedAt: 'DESC' },
        });
        return relations.map((relation) => ({
            id: relation.addressee.id,
            username: relation.addressee.username,
            avatar: relation.addressee.avatar ?? null,
            blockedAt: relation.updatedAt,
        }));
    }
    async requestFriend(requesterId, addresseeId) {
        if (requesterId === addresseeId) {
            throw new common_1.HttpException('Impossible de vous ajouter vous-meme.', 400);
        }
        const addressee = await this.users.findOne({
            where: { id: addresseeId },
            select: ['id', 'username', 'avatar'],
        });
        if (!addressee) {
            throw new common_1.HttpException('Utilisateur introuvable.', 404);
        }
        const existing = await this.findRelations(requesterId, addresseeId);
        if (existing.length > 0) {
            if (existing.some((r) => r.status === 'blocked')) {
                throw new common_1.HttpException('Relation bloquee.', 403);
            }
            if (existing.some((r) => r.status === 'accepted')) {
                return { status: 'accepted' };
            }
            const pending = existing.find((r) => r.status === 'pending');
            if (pending) {
                if (pending.requester?.id === requesterId &&
                    pending.addressee?.id === addresseeId) {
                    return {
                        id: pending.id,
                        status: pending.status,
                        createdAt: pending.createdAt,
                    };
                }
                if (pending.requester?.id === addresseeId &&
                    pending.addressee?.id === requesterId) {
                    pending.status = 'accepted';
                    const saved = await this.relationships.save(pending);
                    await this.notifications.notifyUser(addresseeId, 'social.friend.accepted', {
                        userId: requesterId,
                    });
                    return {
                        id: saved.id,
                        status: saved.status,
                        updatedAt: saved.updatedAt,
                    };
                }
                return { status: 'pending' };
            }
        }
        const relation = this.relationships.create({
            requester: { id: requesterId },
            addressee: { id: addresseeId },
            status: 'pending',
        });
        const saved = await this.relationships.save(relation);
        await this.notifications.notifyUser(addresseeId, 'social.friend.requested', {
            requesterId,
        });
        return {
            id: saved.id,
            status: saved.status,
            createdAt: saved.createdAt,
        };
    }
    async acceptFriend(userId, requesterId) {
        const relation = await this.relationships.findOne({
            where: {
                requester: { id: requesterId },
                addressee: { id: userId },
                status: 'pending',
            },
        });
        if (!relation) {
            throw new common_1.HttpException('Demande introuvable.', 404);
        }
        relation.status = 'accepted';
        const saved = await this.relationships.save(relation);
        await this.notifications.notifyUser(requesterId, 'social.friend.accepted', {
            userId,
        });
        return {
            id: saved.id,
            status: saved.status,
            updatedAt: saved.updatedAt,
        };
    }
    async rejectFriend(userId, requesterId) {
        const relation = await this.relationships.findOne({
            where: {
                requester: { id: requesterId },
                addressee: { id: userId },
                status: 'pending',
            },
        });
        if (!relation) {
            throw new common_1.HttpException('Demande introuvable.', 404);
        }
        await this.relationships.remove(relation);
        await this.notifications.notifyUser(requesterId, 'social.friend.rejected', {
            userId,
        });
        return { removed: true };
    }
    async cancelRequest(userId, targetId) {
        const relation = await this.relationships.findOne({
            where: {
                requester: { id: userId },
                addressee: { id: targetId },
                status: 'pending',
            },
        });
        if (!relation) {
            throw new common_1.HttpException('Demande introuvable.', 404);
        }
        await this.relationships.remove(relation);
        return { removed: true };
    }
    async removeFriend(userId, targetId) {
        const relation = await this.findAcceptedRelation(userId, targetId);
        if (!relation) {
            throw new common_1.HttpException('Amitie introuvable.', 404);
        }
        await this.relationships.remove(relation);
        return { removed: true };
    }
    async blockUser(userId, targetId) {
        if (userId === targetId) {
            throw new common_1.HttpException('Impossible de vous bloquer vous-meme.', 400);
        }
        const target = await this.users.findOne({
            where: { id: targetId },
            select: ['id', 'username'],
        });
        if (!target) {
            throw new common_1.HttpException('Utilisateur introuvable.', 404);
        }
        const existing = await this.findRelations(userId, targetId);
        const alreadyBlocked = existing.find((r) => r.status === 'blocked' &&
            r.requester.id === userId &&
            r.addressee.id === targetId);
        if (alreadyBlocked) {
            return {
                id: alreadyBlocked.id,
                status: alreadyBlocked.status,
                updatedAt: alreadyBlocked.updatedAt,
            };
        }
        const pending = existing.filter((r) => r.status === 'pending');
        if (pending.length > 0) {
            await this.relationships.remove(pending);
        }
        const blocked = this.relationships.create({
            requester: { id: userId },
            addressee: { id: targetId },
            status: 'blocked',
        });
        const saved = await this.relationships.save(blocked);
        return { id: saved.id, status: saved.status, updatedAt: saved.updatedAt };
    }
    async unblockUser(userId, targetId) {
        const relation = await this.relationships.findOne({
            where: {
                requester: { id: userId },
                addressee: { id: targetId },
                status: 'blocked',
            },
        });
        if (!relation) {
            throw new common_1.HttpException('Blocage introuvable.', 404);
        }
        await this.relationships.remove(relation);
        return { removed: true };
    }
    async getProfile(viewerId, targetId) {
        const profile = await this.ensureProfile(targetId);
        const canView = await this.canViewProfile(viewerId, targetId, profile);
        return {
            user: {
                id: profile.user.id,
                username: profile.user.username,
                avatar: profile.user.avatar ?? null,
            },
            bio: canView ? (profile.bio ?? '') : '',
            visibility: profile.visibility,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            isOwner: viewerId === targetId,
            canView,
        };
    }
    async updateProfile(userId, bio, visibility) {
        const profile = await this.ensureProfile(userId);
        if (typeof bio === 'string') {
            const trimmed = bio.trim();
            const length = trimmed.length;
            const settings = this.profileSettings.get();
            if (length < settings.bioMinLength || length > settings.bioMaxLength) {
                throw new common_1.HttpException(`Bio invalide (longueur ${length}). Requis: ${settings.bioMinLength}-${settings.bioMaxLength} caractères.`, 400);
            }
            profile.bio = trimmed;
        }
        if (typeof visibility === 'string') {
            const normalized = visibility
                .trim()
                .toLowerCase();
            if (!PROFILE_VISIBILITY.includes(normalized)) {
                throw new common_1.HttpException('Visibilite invalide.', 400);
            }
            profile.visibility = normalized;
        }
        await this.profiles.save(profile);
        return this.getProfile(userId, userId);
    }
    async searchUsers(query, userId) {
        const sanitized = query.trim();
        if (!sanitized) {
            return [];
        }
        const buildQuery = (accentInsensitive) => {
            const qb = this.users
                .createQueryBuilder('u')
                .leftJoin(social_profile_entity_1.SocialProfile, 'p', 'p.userId = u.id')
                .select('u.id', 'id')
                .addSelect('u.username', 'username')
                .addSelect('u.avatar', 'avatar')
                .addSelect("COALESCE(p.visibility, 'public')", 'profileVisibility')
                .limit(20);
            if (accentInsensitive) {
                qb.where('u.username COLLATE utf8mb4_0900_ai_ci LIKE :query COLLATE utf8mb4_0900_ai_ci', {
                    query: `%${sanitized}%`,
                })
                    .andWhere('u.id != :userId', { userId })
                    .orderBy('u.username COLLATE utf8mb4_0900_ai_ci', 'ASC')
                    .addOrderBy('u.username', 'ASC')
                    .addOrderBy('u.id', 'ASC');
                return qb;
            }
            qb.where('LOWER(u.username) LIKE :query', {
                query: `%${sanitized.toLowerCase()}%`,
            }).andWhere('u.id != :userId', { userId });
            return qb;
        };
        let rows = [];
        try {
            rows = await buildQuery(true).getRawMany();
        }
        catch (error) {
            const message = String(error?.message ?? '');
            if (!/collation/i.test(message)) {
                throw error;
            }
            rows = await buildQuery(false).getRawMany();
        }
        return rows.map((row) => ({
            id: row.id,
            username: row.username,
            avatar: row.avatar ?? null,
            profileVisibility: row.profileVisibility ?? 'public',
        }));
    }
    async ensureProfile(userId) {
        let profile = await this.profiles.findOne({ where: { userId } });
        if (profile) {
            return profile;
        }
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.HttpException('Utilisateur introuvable.', 404);
        }
        profile = this.profiles.create({
            userId,
            user,
            bio: '',
            visibility: 'public',
        });
        return this.profiles.save(profile);
    }
    async canViewProfile(viewerId, targetId, profile) {
        if (viewerId === targetId) {
            return true;
        }
        if (profile.visibility === 'public') {
            return true;
        }
        if (profile.visibility === 'private') {
            return false;
        }
        const relation = await this.findAcceptedRelation(viewerId, targetId);
        return Boolean(relation);
    }
    async findRelations(userId, targetId) {
        return this.relationships.find({
            where: [
                { requester: { id: userId }, addressee: { id: targetId } },
                { requester: { id: targetId }, addressee: { id: userId } },
            ],
        });
    }
    async findAcceptedRelation(userId, targetId) {
        return this.relationships.findOne({
            where: [
                {
                    requester: { id: userId },
                    addressee: { id: targetId },
                    status: 'accepted',
                },
                {
                    requester: { id: targetId },
                    addressee: { id: userId },
                    status: 'accepted',
                },
            ],
        });
    }
};
exports.SocialService = SocialService;
exports.SocialService = SocialService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(social_relationship_entity_1.SocialRelationship)),
    __param(1, (0, typeorm_1.InjectRepository)(social_profile_entity_1.SocialProfile)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        notification_service_1.NotificationService,
        social_profile_settings_service_1.SocialProfileSettingsService])
], SocialService);
//# sourceMappingURL=social.service.js.map