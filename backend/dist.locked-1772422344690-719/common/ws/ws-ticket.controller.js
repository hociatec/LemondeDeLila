"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsTicketController", {
    enumerable: true,
    get: function() {
        return WsTicketController;
    }
});
const _common = require("@nestjs/common");
const _httpjwtguard = require("../guards/http-jwt.guard");
const _wsticketservice = require("./ws-ticket.service");
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
const AllowedScopes = [
    'api',
    'presence',
    'notify',
    'room',
    'game'
];
let WsTicketController = class WsTicketController {
    getTicket(req, scopeRaw) {
        return this.issue(req, scopeRaw);
    }
    // Some deployments proxy only /api/* to the backend. Provide a compatible path as well.
    getTicketUnderApi(req, scopeRaw) {
        return this.issue(req, scopeRaw);
    }
    issue(req, scopeRaw) {
        const scope = String(scopeRaw || '').trim().toLowerCase();
        if (!AllowedScopes.includes(scope)) {
            return {
                error: 'scope invalide',
                allowedScopes: AllowedScopes
            };
        }
        const userId = Number(req.user?.id ?? 0);
        return this.tickets.issue(userId, scope);
    }
    constructor(tickets){
        this.tickets = tickets;
    }
};
_ts_decorate([
    (0, _common.UseGuards)(_httpjwtguard.HttpJwtGuard),
    (0, _common.Get)('ws/ticket'),
    _ts_param(0, (0, _common.Req)()),
    _ts_param(1, (0, _common.Query)('scope')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof RequestWithUser === "undefined" ? Object : RequestWithUser,
        String
    ]),
    _ts_metadata("design:returntype", void 0)
], WsTicketController.prototype, "getTicket", null);
_ts_decorate([
    (0, _common.UseGuards)(_httpjwtguard.HttpJwtGuard),
    (0, _common.Get)('api/ws/ticket'),
    _ts_param(0, (0, _common.Req)()),
    _ts_param(1, (0, _common.Query)('scope')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof RequestWithUser === "undefined" ? Object : RequestWithUser,
        String
    ]),
    _ts_metadata("design:returntype", void 0)
], WsTicketController.prototype, "getTicketUnderApi", null);
WsTicketController = _ts_decorate([
    (0, _common.Controller)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsticketservice.WsTicketService === "undefined" ? Object : _wsticketservice.WsTicketService
    ])
], WsTicketController);
