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
exports.SocialWsHandler = void 0;
const common_1 = require("@nestjs/common");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const ws_auth_1 = require("../../common/ws/ws-auth");
const social_service_1 = require("../services/social.service");
const ws_dto_1 = require("./ws.dto");
let SocialWsHandler = class SocialWsHandler {
    social;
    validator;
    constructor(social, validator) {
        this.social = social;
        this.validator = validator;
    }
    async listFriends(session) {
        const user = (0, ws_auth_1.requireUser)(session);
        const items = await this.social.listFriends(user.id);
        return { type: 'social.friends.list', payload: { items } };
    }
    async listRequests(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialRequestListDto, payload);
        const direction = (dto.direction ?? 'incoming');
        const items = await this.social.listRequests(user.id, direction);
        return { type: 'social.friends.requests', payload: { items } };
    }
    async listBlocked(session) {
        const user = (0, ws_auth_1.requireUser)(session);
        const items = await this.social.listBlocked(user.id);
        return { type: 'social.friends.blocked', payload: { items } };
    }
    async requestFriend(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialUserIdDto, payload);
        const result = await this.social.requestFriend(user.id, dto.userId);
        return { type: 'social.friends.request', payload: result };
    }
    async acceptFriend(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialUserIdDto, payload);
        const result = await this.social.acceptFriend(user.id, dto.userId);
        return { type: 'social.friends.accept', payload: result };
    }
    async rejectFriend(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialUserIdDto, payload);
        const result = await this.social.rejectFriend(user.id, dto.userId);
        return { type: 'social.friends.reject', payload: result };
    }
    async cancelRequest(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialUserIdDto, payload);
        const result = await this.social.cancelRequest(user.id, dto.userId);
        return { type: 'social.friends.cancel', payload: result };
    }
    async removeFriend(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialUserIdDto, payload);
        const result = await this.social.removeFriend(user.id, dto.userId);
        return { type: 'social.friends.remove', payload: result };
    }
    async blockFriend(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialUserIdDto, payload);
        const result = await this.social.blockUser(user.id, dto.userId);
        return { type: 'social.friends.block', payload: result };
    }
    async unblockFriend(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialUserIdDto, payload);
        const result = await this.social.unblockUser(user.id, dto.userId);
        return { type: 'social.friends.unblock', payload: result };
    }
    async getProfile(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialProfileGetDto, payload);
        const targetId = dto.userId ?? user.id;
        const result = await this.social.getProfile(user.id, targetId);
        return { type: 'social.profile.get', payload: { profile: result } };
    }
    async updateProfile(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialProfileUpdateDto, payload);
        const result = await this.social.updateProfile(user.id, dto.bio, dto.visibility);
        return { type: 'social.profile.update', payload: { profile: result } };
    }
    async searchUsers(session, payload) {
        const user = (0, ws_auth_1.requireUser)(session);
        const dto = this.validator.validate(ws_dto_1.SocialSearchDto, payload);
        const items = await this.social.searchUsers(dto.query, user.id);
        return { type: 'social.user.search', payload: { items } };
    }
};
exports.SocialWsHandler = SocialWsHandler;
exports.SocialWsHandler = SocialWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [social_service_1.SocialService,
        payload_validation_service_1.PayloadValidationService])
], SocialWsHandler);
//# sourceMappingURL=social-ws.handler.js.map