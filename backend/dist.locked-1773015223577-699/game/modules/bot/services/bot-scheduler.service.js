"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BotSchedulerService", {
    enumerable: true,
    get: function() {
        return BotSchedulerService;
    }
});
const _common = require("@nestjs/common");
const _playinglogger = require("../../../../common/utils/playing-logger");
const _stringvalueutils = require("../../../../common/utils/string-value.utils");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let BotSchedulerService = class BotSchedulerService {
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
        if (this.timers.has(key)) return;
        const timer = setTimeout(()=>{
            // IMPORTANT: libère le verrou dès que le timer se déclenche.
            // Sinon, si `run()` détecte un état "stale" et retourne sans jouer,
            // aucun nouveau timer ne pourra être planifié et le tour bot restera bloqué.
            this.timers.delete(key);
            (0, _playinglogger.playingLog)('engine.bot.timer', {
                roomId,
                gameType
            });
            run().catch((err)=>{
                if (this.isRoomNotFound(err)) {
                    this.clear(key);
                    (0, _playinglogger.playingLog)('engine.bot.stale', {
                        roomId,
                        gameType,
                        reason: err instanceof Error ? err.message : (0, _stringvalueutils.stringOrEmpty)(err)
                    });
                    onStale?.(err);
                    return;
                }
                (0, _playinglogger.playingLog)('engine.bot.error', {
                    roomId,
                    gameType,
                    message: err instanceof Error ? err.message : (0, _stringvalueutils.stringOrEmpty)(err)
                });
            });
        }, delayMs);
        this.timers.set(key, timer);
    }
    isRoomNotFound(err) {
        if (err instanceof _common.NotFoundException) return true;
        const message = err instanceof Error ? err.message : (0, _stringvalueutils.stringOrEmpty)(err);
        return message.includes('Room introuvable') || message.includes('Table introuvable');
    }
    constructor(){
        this.timers = new Map();
    }
};
BotSchedulerService = _ts_decorate([
    (0, _common.Injectable)()
], BotSchedulerService);
