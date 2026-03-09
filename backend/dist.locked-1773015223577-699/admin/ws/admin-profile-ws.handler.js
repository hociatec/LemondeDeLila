"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminProfileWsHandler", {
    enumerable: true,
    get: function() {
        return AdminProfileWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _socialprofilesettingsservice = require("../../social/services/social-profile-settings.service");
const _adminprofilesettingsdto = require("./admin-profile-settings.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminProfileWsHandler = class AdminProfileWsHandler {
    profileSettingsGet(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        this.validator.validate(_adminprofilesettingsdto.AdminProfileSettingsGetWsDto, payload ?? {});
        return {
            type: 'admin.profile.settings.get',
            payload: this.settings.get()
        };
    }
    async profileSettingsUpdate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminprofilesettingsdto.AdminProfileSettingsUpdateWsDto, payload);
        const updated = await this.settings.update({
            bioMinLength: dto.bioMinLength,
            bioMaxLength: dto.bioMaxLength
        });
        return {
            type: 'admin.profile.settings.update',
            payload: updated
        };
    }
    constructor(validator, settings){
        this.validator = validator;
        this.settings = settings;
    }
};
AdminProfileWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _socialprofilesettingsservice.SocialProfileSettingsService === "undefined" ? Object : _socialprofilesettingsservice.SocialProfileSettingsService
    ])
], AdminProfileWsHandler);
