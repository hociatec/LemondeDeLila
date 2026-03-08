"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SocialWsHandler", {
    enumerable: true,
    get: function() {
        return SocialWsHandler;
    }
});
const _common = require("@nestjs/common");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _wsauth = require("../../common/ws/ws-auth");
const _socialservice = require("../services/social.service");
const _wsdto = require("./ws.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let SocialWsHandler = class SocialWsHandler {
    async listFriends(session) {
        const user = (0, _wsauth.requireUser)(session);
        const items = await this.social.listFriends(user.id);
        return {
            type: 'social.friends.list',
            payload: {
                items
            }
        };
    }
    async listRequests(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialRequestListDto, payload);
        const direction = dto.direction ?? 'incoming';
        const items = await this.social.listRequests(user.id, direction);
        return {
            type: 'social.friends.requests',
            payload: {
                items
            }
        };
    }
    async listBlocked(session) {
        const user = (0, _wsauth.requireUser)(session);
        const items = await this.social.listBlocked(user.id);
        return {
            type: 'social.friends.blocked',
            payload: {
                items
            }
        };
    }
    async requestFriend(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialUserIdDto, payload);
        const result = await this.social.requestFriend(user.id, dto.userId);
        return {
            type: 'social.friends.request',
            payload: result
        };
    }
    async acceptFriend(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialUserIdDto, payload);
        const result = await this.social.acceptFriend(user.id, dto.userId);
        return {
            type: 'social.friends.accept',
            payload: result
        };
    }
    async rejectFriend(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialUserIdDto, payload);
        const result = await this.social.rejectFriend(user.id, dto.userId);
        return {
            type: 'social.friends.reject',
            payload: result
        };
    }
    async cancelRequest(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialUserIdDto, payload);
        const result = await this.social.cancelRequest(user.id, dto.userId);
        return {
            type: 'social.friends.cancel',
            payload: result
        };
    }
    async removeFriend(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialUserIdDto, payload);
        const result = await this.social.removeFriend(user.id, dto.userId);
        return {
            type: 'social.friends.remove',
            payload: result
        };
    }
    async blockFriend(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialUserIdDto, payload);
        const result = await this.social.blockUser(user.id, dto.userId);
        return {
            type: 'social.friends.block',
            payload: result
        };
    }
    async unblockFriend(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialUserIdDto, payload);
        const result = await this.social.unblockUser(user.id, dto.userId);
        return {
            type: 'social.friends.unblock',
            payload: result
        };
    }
    async getProfile(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialProfileGetDto, payload);
        const targetId = dto.userId ?? user.id;
        const result = await this.social.getProfile(user.id, targetId);
        return {
            type: 'social.profile.get',
            payload: {
                profile: result
            }
        };
    }
    async updateProfile(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialProfileUpdateDto, payload);
        const result = await this.social.updateProfile(user.id, dto.bio, dto.visibility);
        return {
            type: 'social.profile.update',
            payload: {
                profile: result
            }
        };
    }
    async searchUsers(session, payload) {
        const user = (0, _wsauth.requireUser)(session);
        const dto = this.validator.validate(_wsdto.SocialSearchDto, payload);
        const items = await this.social.searchUsers(dto.query, user.id);
        return {
            type: 'social.user.search',
            payload: {
                items
            }
        };
    }
    constructor(social, validator){
        this.social = social;
        this.validator = validator;
    }
};
SocialWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _socialservice.SocialService === "undefined" ? Object : _socialservice.SocialService,
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService
    ])
], SocialWsHandler);
