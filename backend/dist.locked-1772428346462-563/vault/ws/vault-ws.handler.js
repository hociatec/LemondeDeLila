"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "VaultWsHandler", {
    enumerable: true,
    get: function() {
        return VaultWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _vaultroomsnapshotsservice = require("../services/vault-room-snapshots.service");
const _vaultwsdto = require("./vault-ws.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let VaultWsHandler = class VaultWsHandler {
    async list(session) {
        const user = (0, _wsauth.requireUser)(session);
        const items = await this.vault.list(user.id);
        return {
            type: 'vault.list',
            payload: {
                items
            }
        };
    }
    async save(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_vaultwsdto.VaultSaveWsDto, payload);
        const res = await this.vault.save(user.id, dto.roomId, dto.id);
        return {
            type: 'vault.save',
            payload: {
                id: res.id
            }
        };
    }
    async restore(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_vaultwsdto.VaultIdWsDto, payload);
        const res = await this.vault.restore(user.id, dto.id);
        return {
            type: 'vault.restore',
            payload: {
                roomId: res.roomId
            }
        };
    }
    async delete(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_vaultwsdto.VaultIdWsDto, payload);
        const ok = await this.vault.delete(user.id, dto.id);
        return {
            type: 'vault.delete',
            payload: {
                ok
            }
        };
    }
    async abandon(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_vaultwsdto.VaultAbandonWsDto, payload);
        const ok = await this.vault.abandonRestoredRoom(user.id, dto.roomId);
        return {
            type: 'vault.abandon',
            payload: {
                ok
            }
        };
    }
    constructor(validator, vault){
        this.validator = validator;
        this.vault = vault;
    }
};
VaultWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _vaultroomsnapshotsservice.VaultRoomSnapshotsService === "undefined" ? Object : _vaultroomsnapshotsservice.VaultRoomSnapshotsService
    ])
], VaultWsHandler);
