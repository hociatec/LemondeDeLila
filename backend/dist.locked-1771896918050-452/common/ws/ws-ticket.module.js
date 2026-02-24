"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsTicketModule = void 0;
const common_1 = require("@nestjs/common");
const ws_ticket_controller_1 = require("./ws-ticket.controller");
const ws_ticket_service_1 = require("./ws-ticket.service");
const ws_ticket_auth_service_1 = require("./ws-ticket-auth.service");
let WsTicketModule = class WsTicketModule {
};
exports.WsTicketModule = WsTicketModule;
exports.WsTicketModule = WsTicketModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        controllers: [ws_ticket_controller_1.WsTicketController],
        providers: [ws_ticket_service_1.WsTicketService, ws_ticket_auth_service_1.WsTicketAuthService],
        exports: [ws_ticket_service_1.WsTicketService, ws_ticket_auth_service_1.WsTicketAuthService],
    })
], WsTicketModule);
//# sourceMappingURL=ws-ticket.module.js.map