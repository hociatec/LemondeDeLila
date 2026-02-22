"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const messaging_service_1 = require("./services/messaging.service");
const message_validator_service_1 = require("./services/message-validator.service");
const private_message_entity_1 = require("./entities/private-message.entity");
const user_entity_1 = require("../user/entities/user.entity");
const messaging_ws_handler_1 = require("./ws/messaging-ws.handler");
const messaging_ws_registrar_1 = require("./ws/messaging-ws.registrar");
const notification_module_1 = require("../notification/notification.module");
let MessagingModule = class MessagingModule {
};
exports.MessagingModule = MessagingModule;
exports.MessagingModule = MessagingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([private_message_entity_1.PrivateMessage, user_entity_1.User]),
            notification_module_1.NotificationModule,
        ],
        providers: [
            messaging_service_1.MessagingService,
            message_validator_service_1.MessageValidatorService,
            messaging_ws_handler_1.MessagingWsHandler,
            messaging_ws_registrar_1.MessagingWsRegistrar,
        ],
        exports: [messaging_service_1.MessagingService],
    })
], MessagingModule);
//# sourceMappingURL=messaging.module.js.map