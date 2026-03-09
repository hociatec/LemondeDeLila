"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NawakPresenterService", {
    enumerable: true,
    get: function() {
        return NawakPresenterService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gamedefinition = require("../definitions/game.definition");
const _lamalikepresenterhelper = require("../../../../presenters/lamalike-presenter.helper");
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
let NawakPresenterService = class NawakPresenterService {
    exposeStateForUser(state, userId) {
        const meta = state.metadata ?? {};
        const actions = _rulebook.getAvailableActions(state, userId);
        const hand = Array.isArray(meta.currentChallenge?.answers) ? meta.currentChallenge.answers : [];
        const panels = (0, _lamalikepresenterhelper.buildLamaLikePanels)({
            hand,
            discardLabel: 'Défis disponibles',
            scoreLines: Object.entries(meta.scores ?? {}).map(([playerId, value])=>`Joueur ${playerId}: ${value ?? 0}`),
            tableMessage: `Phase : ${meta.roundStage ?? 'en attente'}`
        });
        return {
            ...state,
            catalog: {
                phases: _gamedefinition.NAWAK_GAME.phaseOrder.map((phase)=>phase.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions, (action)=>this.buildLabel(action, meta, state)),
            extras: {
                hand,
                targetScore: meta.targetScore,
                scores: meta.scores,
                stage: meta.roundStage,
                challenge: meta.currentChallenge,
                submissions: meta.submissions,
                votes: meta.votes,
                lastRound: meta.lastRound ?? null,
                ui: {
                    panels
                }
            },
            pending: state.pending ?? null
        };
    }
    buildLabel(action, meta, state) {
        if (action.type === 'choose_answer') {
            const index = Number(action.payload?.answerIndex ?? 0);
            const raw = meta.currentChallenge.answers?.[index] ?? `réponse ${index + 1}`;
            const answer = String(raw).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
            return `Choisir «${answer.length > 0 ? answer : `réponse ${index + 1}`}»`;
        }
        if (action.type === 'vote_answer') {
            const target = Number(action.payload?.targetPlayerId ?? 0);
            return `Voter pour ${(0, _playernamehelper.resolvePlayerName)(state.players, target)}`;
        }
        return action.type;
    }
};
NawakPresenterService = _ts_decorate([
    (0, _common.Injectable)()
], NawakPresenterService);
