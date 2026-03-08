"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsTicketModule", {
    enumerable: true,
    get: function() {
        return WsTicketModule;
    }
});
const _common = require("@nestjs/common");
const _wsticketcontroller = require("./ws-ticket.controller");
const _wsticketservice = require("./ws-ticket.service");
const _wsticketauthservice = require("./ws-ticket-auth.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let WsTicketModule = class WsTicketModule {
};
WsTicketModule = _ts_decorate([
    (0, _common.Global)(),
    (0, _common.Module)({
        controllers: [
            _wsticketcontroller.WsTicketController
        ],
        providers: [
            _wsticketservice.WsTicketService,
            _wsticketauthservice.WsTicketAuthService
        ],
        exports: [
            _wsticketservice.WsTicketService,
            _wsticketauthservice.WsTicketAuthService
        ]
    })
], WsTicketModule);
