"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomInviteService", {
    enumerable: true,
    get: function() {
        return RoomInviteService;
    }
});
const _common = require("@nestjs/common");
const _crypto = require("crypto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let RoomInviteService = class RoomInviteService {
    create(roomId, fromUserId, toUserId) {
        this.cleanupExpired();
        const invite = {
            id: (0, _crypto.randomUUID)(),
            roomId,
            fromUserId,
            toUserId,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.ttlMs,
            consumedAt: null
        };
        this.invites.set(invite.id, invite);
        return invite;
    }
    get(id) {
        const invite = this.invites.get(id) ?? null;
        if (!invite) return null;
        if (invite.expiresAt <= Date.now()) {
            this.invites.delete(id);
            return null;
        }
        return invite;
    }
    findActive(roomId, toUserId) {
        this.cleanupExpired();
        for (const invite of this.invites.values()){
            if (invite.roomId === roomId && invite.toUserId === toUserId && !invite.consumedAt) {
                return invite;
            }
        }
        return null;
    }
    /**
   * "Consomme" une invitation. Par défaut on la supprime (one-shot).
   * Si `keep=true`, on la garde jusqu'à expiration pour autoriser une connexion
   * immédiate (ex: spectateur sur table privée déjà démarrée).
   */ consume(id, opts) {
        const invite = this.get(id);
        if (!invite) return null;
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
        for (const invite of this.invites.values()){
            if (invite.roomId === roomId && invite.toUserId === userId && Boolean(invite.consumedAt)) {
                return true;
            }
        }
        return false;
    }
    cleanupExpired() {
        const now = Date.now();
        for (const [id, invite] of this.invites.entries()){
            if (invite.expiresAt <= now) {
                this.invites.delete(id);
            }
        }
    }
    constructor(){
        this.invites = new Map();
        this.ttlMs = 10 * 60 * 1000; // 10 minutes
    }
};
RoomInviteService = _ts_decorate([
    (0, _common.Injectable)()
], RoomInviteService);
