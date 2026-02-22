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
exports.AdminProfileWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const social_profile_settings_service_1 = require("../../social/services/social-profile-settings.service");
const admin_profile_settings_dto_1 = require("./admin-profile-settings.dto");
let AdminProfileWsHandler = class AdminProfileWsHandler {
    validator;
    settings;
    constructor(validator, settings) {
        this.validator = validator;
        this.settings = settings;
    }
    profileSettingsGet(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        this.validator.validate(admin_profile_settings_dto_1.AdminProfileSettingsGetWsDto, payload ?? {});
        return { type: 'admin.profile.settings.get', payload: this.settings.get() };
    }
    async profileSettingsUpdate(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_profile_settings_dto_1.AdminProfileSettingsUpdateWsDto, payload);
        const updated = await this.settings.update({
            bioMinLength: dto.bioMinLength,
            bioMaxLength: dto.bioMaxLength,
        });
        return { type: 'admin.profile.settings.update', payload: updated };
    }
};
exports.AdminProfileWsHandler = AdminProfileWsHandler;
exports.AdminProfileWsHandler = AdminProfileWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        social_profile_settings_service_1.SocialProfileSettingsService])
], AdminProfileWsHandler);
//# sourceMappingURL=admin-profile-ws.handler.js.map