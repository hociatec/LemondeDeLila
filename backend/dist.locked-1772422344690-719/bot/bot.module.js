"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BotModule", {
    enumerable: true,
    get: function() {
        return BotModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _roombotentity = require("../room/entities/room-bot.entity");
const _roomentity = require("../room/entities/room.entity");
const _roomparticipantentity = require("../room/entities/room-participant.entity");
const _userentity = require("../user/entities/user.entity");
const _botnameentity = require("./entities/bot-name.entity");
const _botservice = require("./services/bot.service");
const _roommodule = require("../room/room.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let BotModule = class BotModule {
};
BotModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _roombotentity.RoomBot,
                _roomentity.Room,
                _roomparticipantentity.RoomParticipant,
                _userentity.User,
                _botnameentity.BotName
            ]),
            (0, _common.forwardRef)(()=>_roommodule.RoomModule)
        ],
        providers: [
            _botservice.BotService
        ],
        exports: [
            _botservice.BotService
        ]
    })
], BotModule);
