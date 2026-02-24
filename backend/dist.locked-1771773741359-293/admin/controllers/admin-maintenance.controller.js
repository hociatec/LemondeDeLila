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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMaintenanceController = void 0;
const common_1 = require("@nestjs/common");
const http_jwt_guard_1 = require("../../common/guards/http-jwt.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
const admin_maintenance_guard_1 = require("../guards/admin-maintenance.guard");
const admin_maintenance_service_1 = require("../services/admin-maintenance.service");
let AdminMaintenanceController = class AdminMaintenanceController {
    maintenance;
    constructor(maintenance) {
        this.maintenance = maintenance;
    }
    health() {
        return this.maintenance.getHealth();
    }
    deploy() {
        return this.maintenance.startDeploy();
    }
    dryRunBuild() {
        return this.maintenance.dryRunBuild();
    }
    migrationsRun() {
        return this.maintenance.runMigrations();
    }
    restartService() {
        return this.maintenance.startRestartBackend();
    }
    buildAndRestartService() {
        return this.maintenance.startBuildAndRestartBackend();
    }
    systemdDaemonReload() {
        return this.maintenance.daemonReload();
    }
    deployStatus() {
        return this.maintenance.getDeployStatus();
    }
    deployLogs(tail) {
        return this.maintenance.getDeployLogs({ tail });
    }
    serviceStatus() {
        return this.maintenance.getBackendServiceStatus();
    }
};
exports.AdminMaintenanceController = AdminMaintenanceController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "health", null);
__decorate([
    (0, common_1.Post)('deploy'),
    (0, common_1.HttpCode)(202),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "deploy", null);
__decorate([
    (0, common_1.Post)('deploy/dry-run'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "dryRunBuild", null);
__decorate([
    (0, common_1.Post)('migrations/run'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "migrationsRun", null);
__decorate([
    (0, common_1.Post)('service/restart'),
    (0, common_1.HttpCode)(202),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "restartService", null);
__decorate([
    (0, common_1.Post)('service/build-restart'),
    (0, common_1.HttpCode)(202),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "buildAndRestartService", null);
__decorate([
    (0, common_1.Post)('systemd/daemon-reload'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "systemdDaemonReload", null);
__decorate([
    (0, common_1.Get)('deploy/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "deployStatus", null);
__decorate([
    (0, common_1.Get)('deploy/logs'),
    __param(0, (0, common_1.Query)('tail')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "deployLogs", null);
__decorate([
    (0, common_1.Get)('service/status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "serviceStatus", null);
exports.AdminMaintenanceController = AdminMaintenanceController = __decorate([
    (0, common_1.Controller)('api/admin/maintenance'),
    (0, common_1.UseGuards)(http_jwt_guard_1.HttpJwtGuard, admin_role_guard_1.AdminRoleGuard, admin_maintenance_guard_1.AdminMaintenanceGuard),
    __metadata("design:paramtypes", [admin_maintenance_service_1.AdminMaintenanceService])
], AdminMaintenanceController);
//# sourceMappingURL=admin-maintenance.controller.js.map