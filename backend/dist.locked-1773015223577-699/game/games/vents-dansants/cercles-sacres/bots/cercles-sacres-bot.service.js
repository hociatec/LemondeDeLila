"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CerclesSacresBotService", {
    enumerable: true,
    get: function() {
        return CerclesSacresBotService;
    }
});
const _common = require("@nestjs/common");
const _botrunnerservice = require("../../../../modules/bot/services/bot-runner.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _cerclessacrescards = require("../model/cercles-sacres-cards");
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
const CIRCLE_THEMES = [
    'totem',
    'nature',
    'plante',
    'esprit',
    'parole',
    'nation'
];
let CerclesSacresBotService = class CerclesSacresBotService {
    getBotActions(state, botPlayerId) {
        const actions = _rulebook.getAvailableActions(state, botPlayerId);
        if (!actions.length) return [];
        const circleAction = actions.find((action)=>action.type === 'form_circle');
        if (circleAction) {
            const combo = this.buildCircle(state, botPlayerId);
            if (combo.length === CIRCLE_THEMES.length) {
                return [
                    {
                        type: 'form_circle',
                        payload: {
                            cardIds: combo
                        }
                    }
                ];
            }
        }
        return this.botRunner.choose(actions, {
            state,
            playerId: botPlayerId
        }, 'greedy', {
            preferTypes: [
                'form_circle',
                'discard_card'
            ],
            fallbackTypes: [
                'discard_card',
                'pass'
            ]
        });
    }
    buildCircle(state, playerId) {
        const meta = state.metadata ?? {};
        const hand = Array.isArray(meta.hands?.[playerId]) ? meta.hands[playerId] : [];
        const cardsByTheme = new Map();
        for (const cardId of hand){
            const definition = _cerclessacrescards.CERCLES_SACRES_CARD_BY_ID[cardId];
            if (!definition) continue;
            const list = cardsByTheme.get(definition.theme) ?? [];
            list.push(cardId);
            cardsByTheme.set(definition.theme, list);
        }
        const combo = [];
        for (const theme of CIRCLE_THEMES){
            const choices = cardsByTheme.get(theme);
            if (!choices?.length) {
                return [];
            }
            combo.push(choices[Math.floor(Math.random() * choices.length)]);
        }
        return combo;
    }
    constructor(botRunner){
        this.botRunner = botRunner;
    }
};
CerclesSacresBotService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _botrunnerservice.BotRunnerService === "undefined" ? Object : _botrunnerservice.BotRunnerService
    ])
], CerclesSacresBotService);
