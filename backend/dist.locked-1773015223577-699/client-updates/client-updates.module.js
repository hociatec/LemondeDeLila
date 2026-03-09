"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ClientUpdatesModule", {
    enumerable: true,
    get: function() {
        return ClientUpdatesModule;
    }
});
const _common = require("@nestjs/common");
const _clientupdatescontroller = require("./controllers/client-updates.controller");
const _adminclientupdatescontroller = require("./controllers/admin-client-updates.controller");
const _ciclientupdatescontroller = require("./controllers/ci-client-updates.controller");
const _clientupdatesservice = require("./services/client-updates.service");
const _clientupdatesuploadservice = require("./services/client-updates-upload.service");
const _httpjwtguard = require("../common/guards/http-jwt.guard");
const _adminroleguard = require("../common/guards/admin-role.guard");
const _clientupdatesuploadtokenguard = require("./guards/client-updates-upload-token.guard");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let ClientUpdatesModule = class ClientUpdatesModule {
};
ClientUpdatesModule = _ts_decorate([
    (0, _common.Module)({
        controllers: [
            _clientupdatescontroller.ClientUpdatesController,
            _adminclientupdatescontroller.AdminClientUpdatesController,
            _ciclientupdatescontroller.CiClientUpdatesController
        ],
        providers: [
            _clientupdatesservice.ClientUpdatesService,
            _clientupdatesuploadservice.ClientUpdatesUploadService,
            _httpjwtguard.HttpJwtGuard,
            _adminroleguard.AdminRoleGuard,
            _clientupdatesuploadtokenguard.ClientUpdatesUploadTokenGuard
        ],
        exports: [
            _clientupdatesservice.ClientUpdatesService
        ]
    })
], ClientUpdatesModule);
