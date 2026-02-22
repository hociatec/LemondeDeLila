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
exports.WsTicketController = void 0;
const common_1 = require("@nestjs/common");
const http_jwt_guard_1 = require("../guards/http-jwt.guard");
const ws_ticket_service_1 = require("./ws-ticket.service");
const AllowedScopes = [
    'api',
    'presence',
    'notify',
    'room',
    'game',
];
let WsTicketController = class WsTicketController {
    tickets;
    constructor(tickets) {
        this.tickets = tickets;
    }
    getTicket(req, scopeRaw) {
        return this.issue(req, scopeRaw);
    }
    getTicketUnderApi(req, scopeRaw) {
        return this.issue(req, scopeRaw);
    }
    issue(req, scopeRaw) {
        const scope = String(scopeRaw || '')
            .trim()
            .toLowerCase();
        if (!AllowedScopes.includes(scope)) {
            return { error: 'scope invalide', allowedScopes: AllowedScopes };
        }
        const userId = Number(req.user?.id ?? 0);
        return this.tickets.issue(userId, scope);
    }
};
exports.WsTicketController = WsTicketController;
__decorate([
    (0, common_1.UseGuards)(http_jwt_guard_1.HttpJwtGuard),
    (0, common_1.Get)('ws/ticket'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('scope')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WsTicketController.prototype, "getTicket", null);
__decorate([
    (0, common_1.UseGuards)(http_jwt_guard_1.HttpJwtGuard),
    (0, common_1.Get)('api/ws/ticket'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('scope')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WsTicketController.prototype, "getTicketUnderApi", null);
exports.WsTicketController = WsTicketController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [ws_ticket_service_1.WsTicketService])
], WsTicketController);
//# sourceMappingURL=ws-ticket.controller.js.map