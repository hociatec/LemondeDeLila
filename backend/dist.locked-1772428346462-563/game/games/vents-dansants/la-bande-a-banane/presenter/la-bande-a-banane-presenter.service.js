"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BandeABananePresenterService", {
    enumerable: true,
    get: function() {
        return BandeABananePresenterService;
    }
});
const _common = require("@nestjs/common");
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
let BandeABananePresenterService = class BandeABananePresenterService {
    exposeStateForUser(state, userId) {
        const meta = state.metadata ?? {};
        const actions = _rulebook.getAvailableActions(state, userId);
        const hand = Array.isArray(meta.hands?.[userId]) ? [
            ...meta.hands[userId]
        ] : [];
        const handCounts = (0, _lamalikepresenterhelper.summarizeHandCounts)(meta.hands);
        const panels = (0, _lamalikepresenterhelper.buildLamaLikePanels)({
            hand,
            handCounts,
            discardLabel: 'Troops en jeu',
            tableMessage: `Statut: ${state.status ?? 'en attente'}`
        });
        return {
            ...state,
            catalog: {
                phases: _gamedefinition.BANDE_A_BANANE_GAME.phaseOrder.map((phase)=>phase.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            extras: {
                hand,
                hands: meta.hands,
                troops: meta.troops,
                statuses: meta.statuses,
                ui: {
                    panels
                }
            },
            pending: state.pending ?? null
        };
    }
};
BandeABananePresenterService = _ts_decorate([
    (0, _common.Injectable)()
], BandeABananePresenterService);
