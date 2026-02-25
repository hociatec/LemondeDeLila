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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = require("crypto");
const user_entity_1 = require("../../user/entities/user.entity");
const bcrypt = bcrypt_1.default;
let AdminUsersService = class AdminUsersService {
    users;
    constructor(users) {
        this.users = users;
    }
    async clearExpiredBans() {
        const now = new Date();
        await this.users
            .createQueryBuilder()
            .update(user_entity_1.User)
            .set({ bannedUntil: null, banReason: null })
            .where('banned_until IS NOT NULL AND banned_until <= :now', { now })
            .execute();
        await this.users
            .createQueryBuilder()
            .update(user_entity_1.User)
            .set({ chatBannedUntil: null, chatBanReason: null })
            .where('chat_banned_until IS NOT NULL AND chat_banned_until <= :now', {
            now,
        })
            .execute();
    }
    async list(query) {
        await this.clearExpiredBans();
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
        const qb = this.users
            .createQueryBuilder('user')
            .select([
            'user.id',
            'user.email',
            'user.username',
            'user.avatar',
            'user.roles',
            'user.emailVerified',
            'user.bannedUntil',
            'user.banReason',
            'user.chatBannedUntil',
            'user.chatBanReason',
            'user.createdAt',
        ])
            .orderBy('user.id', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        if (query.search) {
            const q = `%${query.search.trim()}%`;
            qb.andWhere('(user.email LIKE :q OR user.username LIKE :q)', { q });
        }
        const now = new Date();
        if (query.role) {
            qb.andWhere('JSON_CONTAINS(user.roles, :role, "$") = 1', {
                role: `"${query.role}"`,
            });
        }
        if (query.status === 'active') {
            qb.andWhere('(user.banned_until IS NULL OR user.banned_until <= :now)', {
                now,
            });
        }
        else if (query.status === 'banned') {
            qb.andWhere('user.banned_until > :now', { now });
        }
        if (query.createdAfter) {
            const after = new Date(query.createdAfter);
            if (!Number.isNaN(after.getTime())) {
                qb.andWhere('user.created_at >= :after', { after });
            }
        }
        if (query.createdBefore) {
            const before = new Date(query.createdBefore);
            if (!Number.isNaN(before.getTime())) {
                qb.andWhere('user.created_at <= :before', { before });
            }
        }
        const [items, total] = await qb.getManyAndCount();
        return { items, total, page, limit };
    }
    async get(id) {
        await this.clearExpiredBans();
        const user = await this.users.findOne({
            where: { id },
            select: [
                'id',
                'email',
                'username',
                'avatar',
                'roles',
                'emailVerified',
                'bannedUntil',
                'banReason',
                'chatBannedUntil',
                'chatBanReason',
                'createdAt',
            ],
        });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable');
        }
        return user;
    }
    async create(body) {
        const email = body.email.toLowerCase();
        await this.ensureEmailAvailable(email);
        await this.ensureUsernameAvailable(body.username);
        const password = body.password?.trim() || this.generatePassword();
        const hash = await bcrypt.hash(password, 10);
        const roles = body.roles?.length ? body.roles : ['ROLE_USER'];
        const user = this.users.create({
            email,
            username: body.username,
            password: hash,
            roles,
            avatar: body.avatar ?? null,
            emailVerified: body.emailVerified ?? true,
        });
        const saved = await this.users.save(user);
        return {
            user: this.omitPassword(saved),
            temporaryPassword: body.password ? undefined : password,
        };
    }
    async update(id, body) {
        const user = await this.users.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable');
        }
        if (body.email && body.email.toLowerCase() !== user.email.toLowerCase()) {
            await this.ensureEmailAvailable(body.email.toLowerCase(), id);
            user.email = body.email.toLowerCase();
        }
        if (body.username && body.username !== user.username) {
            await this.ensureUsernameAvailable(body.username, id);
            user.username = body.username;
        }
        if (body.roles) {
            user.roles = body.roles;
        }
        if (body.bannedUntil !== undefined) {
            user.bannedUntil = body.bannedUntil ? new Date(body.bannedUntil) : null;
        }
        if (body.banReason !== undefined) {
            user.banReason =
                body.banReason === null || body.banReason === undefined
                    ? null
                    : sanitizeBanReason(body.banReason);
        }
        if (body.avatar !== undefined) {
            user.avatar = body.avatar;
        }
        if (body.emailVerified !== undefined) {
            user.emailVerified = body.emailVerified;
        }
        if (body.password) {
            if (!body.password.trim()) {
                throw new common_1.BadRequestException('Mot de passe vide');
            }
            user.password = await bcrypt.hash(body.password, 10);
        }
        const saved = await this.users.save(user);
        return this.omitPassword(saved);
    }
    async resetPassword(id) {
        const user = await this.users.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable');
        }
        const password = this.generatePassword();
        user.password = await bcrypt.hash(password, 10);
        await this.users.save(user);
        return { user: this.omitPassword(user), temporaryPassword: password };
    }
    async ban(id, reason, durationDays, bannedUntil) {
        const user = await this.users.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable');
        }
        if (!reason || !reason.trim()) {
            throw new common_1.BadRequestException('Motif requis');
        }
        let until = null;
        if (bannedUntil) {
            const parsed = new Date(bannedUntil);
            if (Number.isNaN(parsed.getTime())) {
                throw new common_1.BadRequestException('Date de fin invalide');
            }
            until = parsed;
        }
        else if (durationDays && durationDays > 0) {
            until = new Date();
            until.setDate(until.getDate() + durationDays);
        }
        else {
            throw new common_1.BadRequestException('Durée ou date de fin requise');
        }
        user.bannedUntil = until;
        user.banReason = sanitizeBanReason(reason);
        await this.users.save(user);
        return { user: this.omitPassword(user) };
    }
    async unban(id) {
        const user = await this.users.findOne({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException('Utilisateur introuvable');
        }
        user.bannedUntil = null;
        user.banReason = null;
        const saved = await this.users.save(user);
        return { user: this.omitPassword(saved) };
    }
    async delete(id) {
        const existing = await this.users.findOne({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException('Utilisateur introuvable');
        }
        await this.users.delete(id);
        return { deleted: true };
    }
    async ensureEmailAvailable(email, excludeId) {
        const existing = await this.users.findOne({ where: { email } });
        if (existing && existing.id !== excludeId) {
            throw new common_1.ConflictException('Email déjà utilisé');
        }
    }
    async ensureUsernameAvailable(username, excludeId) {
        const existing = await this.users.findOne({ where: { username } });
        if (existing && existing.id !== excludeId) {
            throw new common_1.ConflictException("Nom d'utilisateur déjà utilisé");
        }
    }
    generatePassword() {
        return (0, crypto_1.randomBytes)(6)
            .toString('base64')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 10);
    }
    omitPassword(user) {
        const { password, ...safe } = user;
        void password;
        return safe;
    }
};
exports.AdminUsersService = AdminUsersService;
exports.AdminUsersService = AdminUsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AdminUsersService);
function sanitizeBanReason(reason) {
    const raw = (reason ?? '').toString();
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        throw new common_1.BadRequestException('Motif requis');
    }
    return normalized.length > 255 ? normalized.substring(0, 255) : normalized;
}
//# sourceMappingURL=admin-users.service.js.map