"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomInviteService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let RoomInviteService = class RoomInviteService {
    invites = new Map();
    ttlMs = 10 * 60 * 1000;
    create(roomId, fromUserId, toUserId) {
        this.cleanupExpired();
        const invite = {
            id: (0, crypto_1.randomUUID)(),
            roomId,
            fromUserId,
            toUserId,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.ttlMs,
            consumedAt: null,
        };
        this.invites.set(invite.id, invite);
        return invite;
    }
    get(id) {
        const invite = this.invites.get(id) ?? null;
        if (!invite)
            return null;
        if (invite.expiresAt <= Date.now()) {
            this.invites.delete(id);
            return null;
        }
        return invite;
    }
    findActive(roomId, toUserId) {
        this.cleanupExpired();
        for (const invite of this.invites.values()) {
            if (invite.roomId === roomId &&
                invite.toUserId === toUserId &&
                !invite.consumedAt) {
                return invite;
            }
        }
        return null;
    }
    consume(id, opts) {
        const invite = this.get(id);
        if (!invite)
            return null;
        const keep = opts?.keep === true;
        if (!keep) {
            this.invites.delete(id);
            return invite;
        }
        invite.consumedAt = Date.now();
        this.invites.set(invite.id, invite);
        return invite;
    }
    delete(id) {
        this.invites.delete(id);
    }
    canSpectate(roomId, userId) {
        this.cleanupExpired();
        for (const invite of this.invites.values()) {
            if (invite.roomId === roomId &&
                invite.toUserId === userId &&
                Boolean(invite.consumedAt)) {
                return true;
            }
        }
        return false;
    }
    cleanupExpired() {
        const now = Date.now();
        for (const [id, invite] of this.invites.entries()) {
            if (invite.expiresAt <= now) {
                this.invites.delete(id);
            }
        }
    }
};
exports.RoomInviteService = RoomInviteService;
exports.RoomInviteService = RoomInviteService = __decorate([
    (0, common_1.Injectable)()
], RoomInviteService);
//# sourceMappingURL=room-invite.service.js.map