"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SocialModule", {
    enumerable: true,
    get: function() {
        return SocialModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _notificationmodule = require("../notification/notification.module");
const _userentity = require("../user/entities/user.entity");
const _socialprofileentity = require("./entities/social-profile.entity");
const _socialrelationshipentity = require("./entities/social-relationship.entity");
const _socialprofilesettingsentity = require("./entities/social-profile-settings.entity");
const _socialservice = require("./services/social.service");
const _socialprofilesettingsservice = require("./services/social-profile-settings.service");
const _socialwshandler = require("./ws/social-ws.handler");
const _socialwsregistrar = require("./ws/social-ws.registrar");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let SocialModule = class SocialModule {
};
SocialModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _socialrelationshipentity.SocialRelationship,
                _socialprofileentity.SocialProfile,
                _socialprofilesettingsentity.SocialProfileSettingsEntity,
                _userentity.User
            ]),
            _notificationmodule.NotificationModule
        ],
        providers: [
            _socialprofilesettingsservice.SocialProfileSettingsService,
            _socialservice.SocialService,
            _socialwshandler.SocialWsHandler,
            _socialwsregistrar.SocialWsRegistrar
        ],
        exports: [
            _socialservice.SocialService,
            _socialprofilesettingsservice.SocialProfileSettingsService
        ]
    })
], SocialModule);
