"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const room_bot_entity_1 = require("../room/entities/room-bot.entity");
const room_entity_1 = require("../room/entities/room.entity");
const room_participant_entity_1 = require("../room/entities/room-participant.entity");
const user_entity_1 = require("../user/entities/user.entity");
const bot_name_entity_1 = require("./entities/bot-name.entity");
const bot_service_1 = require("./services/bot.service");
const room_module_1 = require("../room/room.module");
let BotModule = class BotModule {
};
exports.BotModule = BotModule;
exports.BotModule = BotModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([room_bot_entity_1.RoomBot, room_entity_1.Room, room_participant_entity_1.RoomParticipant, user_entity_1.User, bot_name_entity_1.BotName]),
            (0, common_1.forwardRef)(() => room_module_1.RoomModule),
        ],
        providers: [bot_service_1.BotService],
        exports: [bot_service_1.BotService],
    })
], BotModule);
//# sourceMappingURL=bot.module.js.map