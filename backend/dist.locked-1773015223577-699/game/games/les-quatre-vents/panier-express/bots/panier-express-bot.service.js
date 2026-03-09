"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PanierExpressBotService", {
    enumerable: true,
    get: function() {
        return PanierExpressBotService;
    }
});
const _common = require("@nestjs/common");
const _botrunnerservice = require("../../../../modules/bot/services/bot-runner.service");
const _turnstatusservice = require("../../../../modules/turn/services/turn-status.service");
const _playinglogger = require("../../../../../common/utils/playing-logger");
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
let PanierExpressBotService = class PanierExpressBotService {
    getBotActions(state, meta, botPlayerId) {
        const current = state.turn?.currentPlayerId ?? null;
        const isBotTurn = current === botPlayerId;
        const profile = meta.botProfile ?? 'greedy';
        const skip = this.turnStatus.getStatus(state, botPlayerId, 'skipTurn');
        if (isBotTurn && skip > 0) {
            (0, _playinglogger.playingLog)('panier.bot.skip', {
                roomId: state.metadata?.roomId ?? null,
                gameType: state.metadata?.gameType ?? null,
                userId: botPlayerId,
                type: 'skip_turn',
                botPlayerId,
                skip
            });
            return [
                {
                    type: 'skip_turn',
                    payload: {
                        playerId: botPlayerId
                    }
                }
            ];
        }
        const available = this.injectQuizAnswer(_rulebook.getAvailableActions(state, botPlayerId), meta, botPlayerId);
        if (available.length === 0) return [];
        const rawPlayer = (state.players ?? []).find((p)=>p.id === botPlayerId);
        const shoppingListRaw = rawPlayer?.shoppingList;
        const basketRaw = rawPlayer?.basket;
        const shoppingList = Array.isArray(shoppingListRaw) ? shoppingListRaw : [];
        const basket = Array.isArray(basketRaw) ? basketRaw : [];
        if (!Array.isArray(shoppingListRaw) || !Array.isArray(basketRaw)) {
            (0, _playinglogger.playingLog)('panier.bot.warn', {
                roomId: state.metadata?.roomId ?? null,
                gameType: state.metadata?.gameType ?? null,
                userId: botPlayerId,
                type: 'warn',
                playerId: botPlayerId,
                shoppingListType: typeof shoppingListRaw,
                basketType: typeof basketRaw
            });
        }
        const missing = new Set(shoppingList.filter((item)=>!basket.includes(item)));
        const players = state.players ?? [];
        const playerById = new Map(players.map((p)=>[
                p.id,
                p
            ]));
        const score = (action)=>{
            const type = action.type?.toLowerCase() ?? '';
            if (type === 'answer_quiz') return 6;
            if (type === 'pick_choice') {
                const index = typeof action.payload?.index === 'number' ? action.payload.index : 0;
                // Choix déterministe: on préfère les premiers items pour progresser.
                return 8 - Math.max(0, Math.min(6, index));
            }
            if (type === 'exchange_accept' || type === 'exchange_refuse') {
                const pending = state.pending;
                const offer = pending && pending.type === 'exchange' && pending.step === 'confirm' ? pending : null;
                if (!offer || offer.playerId !== botPlayerId) {
                    return type === 'exchange_refuse' ? 1 : 0;
                }
                const give = String(offer.give ?? '').trim();
                const take = offer.take != null ? String(offer.take).trim() : null;
                const giveNeeded = give.length > 0 && missing.has(give);
                const takeNeeded = take != null && take.length > 0 && missing.has(take);
                const bonusRequested = offer.bonusRequested === true;
                // Si accepter fait perdre 2 tours (cible sans cartes), on préfère refuser.
                if (bonusRequested) {
                    return type === 'exchange_refuse' ? 9 : -10;
                }
                if (type === 'exchange_accept') {
                    return 5 + (giveNeeded ? 4 : 0) + (takeNeeded ? -4 : 1);
                }
                return 4 + (takeNeeded ? 3 : 0) + (giveNeeded ? -2 : 0);
            }
            if (type === 'exchange_choose_target') {
                const targetId = action.payload?.targetPlayerId;
                if (typeof targetId !== 'number') return 2;
                const target = playerById.get(targetId);
                const inv = Array.isArray(target?.inventory) ? target.inventory : [];
                const useful = inv.filter((c)=>missing.has(String(c))).length;
                return 4 + useful * 2 + Math.min(2, inv.length / 3);
            }
            if (type === 'exchange_choose_give') {
                const give = action.payload?.give;
                if (typeof give !== 'string') return 2;
                const cost = missing.has(give) ? -2 : 1;
                return 4 + cost;
            }
            if (type === 'draw') return 7;
            if (type === 'roll') return 1;
            return 0;
        };
        const chosen = this.botRunner.choose(available, {
            state,
            playerId: botPlayerId
        }, profile, {
            preferTypes: [
                'draw',
                'answer_quiz',
                'pick_choice',
                'exchange_choose_give',
                'exchange_choose_target',
                'roll'
            ],
            fallbackTypes: [
                'roll'
            ],
            score
        });
        if (chosen.length === 0 && available.length > 0) {
            return [
                available[0]
            ];
        }
        if (chosen.length) {
            (0, _playinglogger.playingLog)('panier.bot.actions', {
                roomId: state.metadata?.roomId ?? null,
                gameType: state.metadata?.gameType ?? null,
                userId: botPlayerId,
                type: 'bot_actions',
                botPlayerId,
                actions: chosen.map((a)=>a.type)
            });
        }
        return chosen;
    }
    injectQuizAnswer(actions, meta, playerId) {
        if (!Array.isArray(actions)) return [];
        const pending = meta.quiz?.pending?.[playerId];
        const choices = Array.isArray(pending?.choices) ? pending?.choices : [];
        if (!pending || !choices.length) return actions;
        // Déterministe (évite de dépendre de Math.random côté bot).
        const answer = choices[0];
        return actions.map((a)=>{
            if (!a || (a.type || '').toLowerCase() !== 'answer_quiz') return a;
            return {
                ...a,
                payload: {
                    ...a.payload ?? {},
                    answer
                }
            };
        });
    }
    constructor(botRunner, turnStatus){
        this.botRunner = botRunner;
        this.turnStatus = turnStatus;
    }
};
PanierExpressBotService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _botrunnerservice.BotRunnerService === "undefined" ? Object : _botrunnerservice.BotRunnerService,
        typeof _turnstatusservice.TurnStatusService === "undefined" ? Object : _turnstatusservice.TurnStatusService
    ])
], PanierExpressBotService);
