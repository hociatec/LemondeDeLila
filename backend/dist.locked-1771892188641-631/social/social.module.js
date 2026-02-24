"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const notification_module_1 = require("../notification/notification.module");
const user_entity_1 = require("../user/entities/user.entity");
const social_profile_entity_1 = require("./entities/social-profile.entity");
const social_relationship_entity_1 = require("./entities/social-relationship.entity");
const social_profile_settings_entity_1 = require("./entities/social-profile-settings.entity");
const social_service_1 = require("./services/social.service");
const social_profile_settings_service_1 = require("./services/social-profile-settings.service");
const social_ws_handler_1 = require("./ws/social-ws.handler");
const social_ws_registrar_1 = require("./ws/social-ws.registrar");
let SocialModule = class SocialModule {
};
exports.SocialModule = SocialModule;
exports.SocialModule = SocialModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                social_relationship_entity_1.SocialRelationship,
                social_profile_entity_1.SocialProfile,
                social_profile_settings_entity_1.SocialProfileSettingsEntity,
                user_entity_1.User,
            ]),
            notification_module_1.NotificationModule,
        ],
        providers: [
            social_profile_settings_service_1.SocialProfileSettingsService,
            social_service_1.SocialService,
            social_ws_handler_1.SocialWsHandler,
            social_ws_registrar_1.SocialWsRegistrar,
        ],
        exports: [social_service_1.SocialService, social_profile_settings_service_1.SocialProfileSettingsService],
    })
], SocialModule);
//# sourceMappingURL=social.module.js.map