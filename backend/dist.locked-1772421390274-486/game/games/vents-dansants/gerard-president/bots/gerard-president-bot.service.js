"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GerardPresidentBotService", {
    enumerable: true,
    get: function() {
        return GerardPresidentBotService;
    }
});
const _common = require("@nestjs/common");
const _botrunnerservice = require("../../../../modules/bot/services/bot-runner.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GerardPresidentBotService = class GerardPresidentBotService {
    getBotActions(state, botPlayerId) {
        const actions = _rulebook.getAvailableActions(state, botPlayerId);
        if (!actions.length) {
            return [];
        }
        const meta = state.metadata ?? {};
        if (meta.roundPhase === 'waiting_theme') {
            return [
                {
                    type: 'set_theme'
                }
            ];
        }
        if (meta.roundPhase === 'collecting_names') {
            const specialAction = this.tryPlaySpecial(meta, actions, botPlayerId);
            if (specialAction) {
                return [
                    specialAction
                ];
            }
            const nameAction = this.tryPlayName(meta, actions, botPlayerId);
            if (nameAction) {
                return [
                    nameAction
                ];
            }
            return [
                {
                    type: 'pass',
                    payload: {}
                }
            ];
        }
        if (meta.roundPhase === 'choosing_winner') {
            const chooseAction = this.tryChooseWinner(meta, actions);
            if (chooseAction) {
                return [
                    chooseAction
                ];
            }
        }
        return this.botRunner.choose(actions, {
            state,
            playerId: botPlayerId
        }, 'random');
    }
    tryPlaySpecial(meta, actions, playerId) {
        const candidate = actions.find((action)=>action.type === 'play_special');
        if (!candidate) return null;
        const specialHand = meta.specialHands?.[playerId] ?? [];
        if (!specialHand.length) return null;
        return {
            type: 'play_special',
            payload: {
                cardId: specialHand[0]
            }
        };
    }
    tryPlayName(meta, actions, playerId) {
        const candidate = actions.find((action)=>action.type === 'play_name');
        if (!candidate) return null;
        const hand = meta.hands?.[playerId] ?? [];
        if (!hand.length) return null;
        const locked = meta.lockedName;
        const extra = Math.max(0, meta.extraNamesAllowed?.[playerId] ?? 0);
        const limit = 1 + extra;
        const selection = [];
        for (const name of hand){
            if (locked && locked === name) {
                continue;
            }
            selection.push(name);
            if (selection.length >= limit) {
                break;
            }
        }
        if (!selection.length) {
            return null;
        }
        return {
            type: 'play_name',
            payload: {
                names: selection
            }
        };
    }
    tryChooseWinner(meta, actions) {
        const candidate = actions.find((action)=>action.type === 'choose_winner');
        if (!candidate) return null;
        const submissions = meta.submissions ?? {};
        const ids = Object.keys(submissions).map((value)=>Number(value)).filter((value)=>Number.isFinite(value));
        if (!ids.length) return null;
        const winnerId = ids[Math.floor(Math.random() * ids.length)];
        return {
            type: 'choose_winner',
            payload: {
                winnerId
            }
        };
    }
    constructor(botRunner){
        this.botRunner = botRunner;
    }
};
GerardPresidentBotService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _botrunnerservice.BotRunnerService === "undefined" ? Object : _botrunnerservice.BotRunnerService
    ])
], GerardPresidentBotService);
