"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CatPattesPresenterService", {
    enumerable: true,
    get: function() {
        return CatPattesPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gamedefinition = require("../definitions/game.definition");
const _catpattescards = require("../model/cat-pattes-cards");
const _catpattesstateentity = require("../model/cat-pattes-state.entity");
const _stringvalueutils = require("../../../../../common/utils/string-value.utils");
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
let CatPattesPresenterService = class CatPattesPresenterService {
    exposeStateForUser(state, userId) {
        const meta = state.metadata ?? {};
        const actions = _rulebook.getAvailableActions(state, userId);
        const pending = this.normalizePending(state.pending, actions);
        const handIds = Array.isArray(meta.hands?.[userId]) ? [
            ...meta.hands[userId]
        ] : [];
        const hand = handIds.map((id)=>_catpattescards.CAT_PATTES_CARD_BY_ID[id]?.name ?? id);
        const players = Array.isArray(state.players) ? state.players : [];
        const nameById = {};
        for (const p of players){
            if (!p?.id) continue;
            nameById[p.id] = p?.username && String(p.username).trim() ? String(p.username).trim() : `Joueur ${p.id}`;
        }
        const scoreLines = players.map((p)=>{
            const pid = p?.id;
            const name = nameById[pid] ?? `Joueur ${pid}`;
            const points = Number(meta.points?.[pid] ?? 0);
            return `${name} : ${points} points.`;
        });
        const progressionLines = players.map((p)=>{
            const pid = p?.id;
            const name = nameById[pid] ?? `Joueur ${pid}`;
            const value = Number(meta.positions?.[pid] ?? 0);
            return `${name} : ${value} pattes / ${_catpattesstateentity.CAT_PATTES_GOAL}.`;
        });
        const handCounts = Object.entries(meta.hands ?? {}).map(([id, cards])=>`Joueur ${id}: ${Array.isArray(cards) ? cards.length : 0}`).join(' • ');
        const extras = {
            hand,
            handIds,
            hands: meta.hands,
            positions: meta.positions,
            points: meta.points,
            obstacles: meta.obstacles,
            bots: meta.bots,
            hasSun: meta.hasSun,
            pawns: meta.pawns,
            pawnByPlayerId: meta.pawnByPlayerId,
            ui: {
                panels: {
                    hand: {
                        title: 'Main',
                        message: hand.length ? `Main : ${hand.join(', ')}` : 'Main : (vide)'
                    },
                    hands: {
                        title: 'Mains',
                        message: handCounts ? `Mains : ${handCounts}` : 'Mains : (inconnues)'
                    },
                    play: {
                        title: 'À jouer',
                        message: '(↑/↓ choisir, Entrée jouer, Espace piocher, C défausser, S score, P progression)'
                    },
                    score: {
                        title: 'Score',
                        message: scoreLines.join(' ')
                    },
                    position: {
                        title: 'Progression',
                        message: progressionLines.join(' ')
                    }
                }
            }
        };
        return {
            ...state,
            catalog: {
                phases: _gamedefinition.CAT_PATTES_GAME.phaseOrder.map((phase)=>phase.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            extras,
            pending
        };
    }
    normalizePending(pending, actions) {
        if (!pending || typeof pending !== 'object') return pending ?? null;
        const type = String(pending?.type ?? '').trim().toLowerCase();
        if (type !== 'choose_pawn') return pending;
        const rawChoices = Array.isArray(pending?.choices) ? pending.choices : [];
        const normalizedChoices = rawChoices.map((choice)=>(0, _stringvalueutils.stringOrEmpty)(choice).trim()).filter((choice)=>choice.length > 0);
        if (normalizedChoices.length > 0) {
            return {
                ...pending,
                choices: normalizedChoices
            };
        }
        const pendingPawns = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
        const pawnsFromPendingData = pendingPawns.map((pawn)=>(0, _stringvalueutils.stringOrEmpty)(pawn?.label ?? pawn?.id ?? '').trim()).filter((choice)=>choice.length > 0);
        if (pawnsFromPendingData.length > 0) {
            return {
                ...pending,
                choices: pawnsFromPendingData
            };
        }
        const pawnsFromActions = (Array.isArray(actions) ? actions : []).filter((action)=>String(action?.type ?? '').trim().toLowerCase() === 'choose_pawn').map((action)=>{
            const payload = action?.payload ?? {};
            return (0, _stringvalueutils.stringOrEmpty)(payload.pawnId ?? payload.pawn ?? payload.value).trim();
        }).filter((choice)=>choice.length > 0);
        if (pawnsFromActions.length > 0) {
            return {
                ...pending,
                choices: pawnsFromActions
            };
        }
        return pending;
    }
};
CatPattesPresenterService = _ts_decorate([
    (0, _common.Injectable)()
], CatPattesPresenterService);
