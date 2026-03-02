"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ChatModule", {
    enumerable: true,
    get: function() {
        return ChatModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _chatmessageentity = require("./entities/chat-message.entity");
const _chatsettingsentity = require("./entities/chat-settings.entity");
const _chatservice = require("./services/chat.service");
const _chatsettingsservice = require("./services/chat-settings.service");
const _chatvalidator = require("./services/chat.validator");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let ChatModule = class ChatModule {
};
ChatModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _chatmessageentity.ChatMessage,
                _chatsettingsentity.ChatSettingsEntity
            ])
        ],
        providers: [
            _chatservice.ChatService,
            _chatsettingsservice.ChatSettingsService,
            _chatvalidator.ChatValidator
        ],
        exports: [
            _chatservice.ChatService,
            _chatsettingsservice.ChatSettingsService,
            _chatvalidator.ChatValidator
        ]
    })
], ChatModule);
