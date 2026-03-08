"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminMaintenanceController", {
    enumerable: true,
    get: function() {
        return AdminMaintenanceController;
    }
});
const _common = require("@nestjs/common");
const _httpjwtguard = require("../../common/guards/http-jwt.guard");
const _adminroleguard = require("../../common/guards/admin-role.guard");
const _adminmaintenanceguard = require("../guards/admin-maintenance.guard");
const _adminmaintenanceservice = require("../services/admin-maintenance.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let AdminMaintenanceController = class AdminMaintenanceController {
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
        return this.maintenance.getDeployLogs({
            tail
        });
    }
    serviceStatus() {
        return this.maintenance.getBackendServiceStatus();
    }
    constructor(maintenance){
        this.maintenance = maintenance;
    }
};
_ts_decorate([
    (0, _common.Get)('health'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "health", null);
_ts_decorate([
    (0, _common.Post)('deploy'),
    (0, _common.HttpCode)(202),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "deploy", null);
_ts_decorate([
    (0, _common.Post)('deploy/dry-run'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "dryRunBuild", null);
_ts_decorate([
    (0, _common.Post)('migrations/run'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "migrationsRun", null);
_ts_decorate([
    (0, _common.Post)('service/restart'),
    (0, _common.HttpCode)(202),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "restartService", null);
_ts_decorate([
    (0, _common.Post)('service/build-restart'),
    (0, _common.HttpCode)(202),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "buildAndRestartService", null);
_ts_decorate([
    (0, _common.Post)('systemd/daemon-reload'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "systemdDaemonReload", null);
_ts_decorate([
    (0, _common.Get)('deploy/status'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "deployStatus", null);
_ts_decorate([
    (0, _common.Get)('deploy/logs'),
    _ts_param(0, (0, _common.Query)('tail')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String
    ]),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "deployLogs", null);
_ts_decorate([
    (0, _common.Get)('service/status'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], AdminMaintenanceController.prototype, "serviceStatus", null);
AdminMaintenanceController = _ts_decorate([
    (0, _common.Controller)('api/admin/maintenance'),
    (0, _common.UseGuards)(_httpjwtguard.HttpJwtGuard, _adminroleguard.AdminRoleGuard, _adminmaintenanceguard.AdminMaintenanceGuard),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _adminmaintenanceservice.AdminMaintenanceService === "undefined" ? Object : _adminmaintenanceservice.AdminMaintenanceService
    ])
], AdminMaintenanceController);
