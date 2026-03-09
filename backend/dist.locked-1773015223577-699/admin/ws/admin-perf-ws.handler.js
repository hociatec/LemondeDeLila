"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminPerfWsHandler", {
    enumerable: true,
    get: function() {
        return AdminPerfWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _perfmetricsservice = require("../../common/services/perf-metrics.service");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _adminwsdto = require("./admin-ws.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminPerfWsHandler = class AdminPerfWsHandler {
    perfSnapshot(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminwsdto.AdminPerfSnapshotWsDto, payload ?? {});
        const snapshot = this.perf.snapshot({
            windowSeconds: dto.windowSeconds
        });
        return {
            type: 'admin.perf.snapshot',
            payload: snapshot
        };
    }
    constructor(validator, perf){
        this.validator = validator;
        this.perf = perf;
    }
};
AdminPerfWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _perfmetricsservice.PerfMetricsService === "undefined" ? Object : _perfmetricsservice.PerfMetricsService
    ])
], AdminPerfWsHandler);
