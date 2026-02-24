"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUpdatesModule = void 0;
const common_1 = require("@nestjs/common");
const client_updates_controller_1 = require("./controllers/client-updates.controller");
const admin_client_updates_controller_1 = require("./controllers/admin-client-updates.controller");
const ci_client_updates_controller_1 = require("./controllers/ci-client-updates.controller");
const client_updates_service_1 = require("./services/client-updates.service");
const client_updates_upload_service_1 = require("./services/client-updates-upload.service");
const http_jwt_guard_1 = require("../common/guards/http-jwt.guard");
const admin_role_guard_1 = require("../common/guards/admin-role.guard");
const client_updates_upload_token_guard_1 = require("./guards/client-updates-upload-token.guard");
let ClientUpdatesModule = class ClientUpdatesModule {
};
exports.ClientUpdatesModule = ClientUpdatesModule;
exports.ClientUpdatesModule = ClientUpdatesModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            client_updates_controller_1.ClientUpdatesController,
            admin_client_updates_controller_1.AdminClientUpdatesController,
            ci_client_updates_controller_1.CiClientUpdatesController,
        ],
        providers: [
            client_updates_service_1.ClientUpdatesService,
            client_updates_upload_service_1.ClientUpdatesUploadService,
            http_jwt_guard_1.HttpJwtGuard,
            admin_role_guard_1.AdminRoleGuard,
            client_updates_upload_token_guard_1.ClientUpdatesUploadTokenGuard,
        ],
        exports: [client_updates_service_1.ClientUpdatesService],
    })
], ClientUpdatesModule);
//# sourceMappingURL=client-updates.module.js.map