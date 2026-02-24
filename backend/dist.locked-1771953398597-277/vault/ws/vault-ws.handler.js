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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const vault_room_snapshots_service_1 = require("../services/vault-room-snapshots.service");
const vault_ws_dto_1 = require("./vault-ws.dto");
let VaultWsHandler = class VaultWsHandler {
    validator;
    vault;
    constructor(validator, vault) {
        this.validator = validator;
        this.vault = vault;
    }
    async list(session) {
        const user = (0, ws_auth_1.requireUser)(session);
        const items = await this.vault.list(user.id);
        return { type: 'vault.list', payload: { items } };
    }
    async save(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(vault_ws_dto_1.VaultSaveWsDto, payload);
        const res = await this.vault.save(user.id, dto.roomId, dto.id);
        return { type: 'vault.save', payload: { id: res.id } };
    }
    async restore(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(vault_ws_dto_1.VaultIdWsDto, payload);
        const res = await this.vault.restore(user.id, dto.id);
        return { type: 'vault.restore', payload: { roomId: res.roomId } };
    }
    async delete(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(vault_ws_dto_1.VaultIdWsDto, payload);
        const ok = await this.vault.delete(user.id, dto.id);
        return { type: 'vault.delete', payload: { ok } };
    }
    async abandon(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(vault_ws_dto_1.VaultAbandonWsDto, payload);
        const ok = await this.vault.abandonRestoredRoom(user.id, dto.roomId);
        return { type: 'vault.abandon', payload: { ok } };
    }
};
exports.VaultWsHandler = VaultWsHandler;
exports.VaultWsHandler = VaultWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        vault_room_snapshots_service_1.VaultRoomSnapshotsService])
], VaultWsHandler);
//# sourceMappingURL=vault-ws.handler.js.map