"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AbsurdissimesPresenterService", {
    enumerable: true,
    get: function() {
        return AbsurdissimesPresenterService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gamedefinition = require("../definitions/game.definition");
const _lamalikepresenterhelper = require("../../../../presenters/lamalike-presenter.helper");
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
let AbsurdissimesPresenterService = class AbsurdissimesPresenterService {
    exposeStateForUser(state, userId) {
        const meta = state.metadata ?? {};
        const actions = _rulebook.getAvailableActions(state, userId);
        const judgeId = _rulebook.getJudgeId(state, meta);
        const hand = meta.blackHands?.[userId] ?? [];
        const handCounts = (0, _lamalikepresenterhelper.summarizeHandCounts)(meta.blackHands);
        const panels = (0, _lamalikepresenterhelper.buildLamaLikePanels)({
            hand,
            handCounts,
            discardLabel: 'Défausse du juge',
            scoreLines: Object.entries(meta.scores ?? {}).map(([playerId, score])=>`Joueur ${playerId}: ${score ?? 0}`),
            tableMessage: `Phase : ${meta.roundStage ?? 'en attente'}`
        });
        return {
            ...state,
            catalog: {
                phases: _gamedefinition.ABSURDISSIMES_GAME.phaseOrder.map((phase)=>phase.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions, (action)=>this.buildLabel(action, state)),
            extras: {
                stage: meta.roundStage,
                currentWhite: meta.currentWhite ?? null,
                judgeId,
                hand,
                remainingPlayers: meta.remainingPlayers ?? [],
                scores: meta.scores,
                targetScore: meta.targetScore,
                submissions: meta.submissions,
                winnerId: meta.winnerId ?? null,
                ui: {
                    panels
                }
            },
            pending: state.pending ?? null
        };
    }
    buildLabel(action, state) {
        if (action.type === 'play_card') {
            const cardId = (0, _stringvalueutils.stringOrEmpty)(action.payload?.cardId);
            return cardId ? `Jouer ${cardId}` : 'Jouer une carte';
        }
        if (action.type === 'judge_pick') {
            const winnerId = Number(action.payload?.winnerId ?? 0);
            return `Choisir ${(0, _playernamehelper.resolvePlayerName)(state.players, winnerId)}`;
        }
        return action.type;
    }
};
AbsurdissimesPresenterService = _ts_decorate([
    (0, _common.Injectable)()
], AbsurdissimesPresenterService);
