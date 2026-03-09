"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NawakBotService", {
    enumerable: true,
    get: function() {
        return NawakBotService;
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
let NawakBotService = class NawakBotService {
    getBotActions(state, botPlayerId) {
        const meta = state.metadata ?? {};
        const stage = meta.roundStage ?? 'choose';
        const preferTypes = stage === 'choose' ? [
            'choose_answer'
        ] : [
            'vote_answer'
        ];
        const fallbackTypes = stage === 'choose' ? [
            'vote_answer'
        ] : [
            'choose_answer'
        ];
        const actions = _rulebook.getAvailableActions(state, botPlayerId);
        if (!actions.length) return [];
        return this.botRunner.choose(actions, {
            state,
            playerId: botPlayerId
        }, 'random', {
            preferTypes,
            fallbackTypes
        });
    }
    constructor(botRunner){
        this.botRunner = botRunner;
    }
};
NawakBotService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _botrunnerservice.BotRunnerService === "undefined" ? Object : _botrunnerservice.BotRunnerService
    ])
], NawakBotService);
