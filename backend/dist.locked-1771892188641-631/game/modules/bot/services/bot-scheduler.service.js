"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const playing_logger_1 = require("../../../../common/utils/playing-logger");
const string_value_utils_1 = require("../../../../common/utils/string-value.utils");
let BotSchedulerService = class BotSchedulerService {
    timers = new Map();
    has(key) {
        return this.timers.has(key);
    }
    clear(key) {
        const timer = this.timers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(key);
        }
    }
    schedule(params) {
        const { key, delayMs, roomId, gameType, run, onStale } = params;
        if (this.timers.has(key))
            return;
        const timer = setTimeout(() => {
            this.timers.delete(key);
            (0, playing_logger_1.playingLog)('engine.bot.timer', { roomId, gameType });
            run().catch((err) => {
                if (this.isRoomNotFound(err)) {
                    this.clear(key);
                    (0, playing_logger_1.playingLog)('engine.bot.stale', {
                        roomId,
                        gameType,
                        reason: err instanceof Error ? err.message : (0, string_value_utils_1.stringOrEmpty)(err),
                    });
                    onStale?.(err);
                    return;
                }
                (0, playing_logger_1.playingLog)('engine.bot.error', {
                    roomId,
                    gameType,
                    message: err instanceof Error ? err.message : (0, string_value_utils_1.stringOrEmpty)(err),
                });
            });
        }, delayMs);
        this.timers.set(key, timer);
    }
    isRoomNotFound(err) {
        if (err instanceof common_1.NotFoundException)
            return true;
        const message = err instanceof Error ? err.message : (0, string_value_utils_1.stringOrEmpty)(err);
        return (message.includes('Room introuvable') ||
            message.includes('Table introuvable'));
    }
};
exports.BotSchedulerService = BotSchedulerService;
exports.BotSchedulerService = BotSchedulerService = __decorate([
    (0, common_1.Injectable)()
], BotSchedulerService);
//# sourceMappingURL=bot-scheduler.service.js.map