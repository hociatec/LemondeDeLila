"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MessagingModule", {
    enumerable: true,
    get: function() {
        return MessagingModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _messagingservice = require("./services/messaging.service");
const _messagevalidatorservice = require("./services/message-validator.service");
const _privatemessageentity = require("./entities/private-message.entity");
const _userentity = require("../user/entities/user.entity");
const _messagingwshandler = require("./ws/messaging-ws.handler");
const _messagingwsregistrar = require("./ws/messaging-ws.registrar");
const _notificationmodule = require("../notification/notification.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let MessagingModule = class MessagingModule {
};
MessagingModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _privatemessageentity.PrivateMessage,
                _userentity.User
            ]),
            _notificationmodule.NotificationModule
        ],
        providers: [
            _messagingservice.MessagingService,
            _messagevalidatorservice.MessageValidatorService,
            _messagingwshandler.MessagingWsHandler,
            _messagingwsregistrar.MessagingWsRegistrar
        ],
        exports: [
            _messagingservice.MessagingService
        ]
    })
], MessagingModule);
