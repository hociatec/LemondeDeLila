"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LaGrandeMineDeBarbakPresenterService", {
    enumerable: true,
    get: function() {
        return LaGrandeMineDeBarbakPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
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
let LaGrandeMineDeBarbakPresenterService = class LaGrandeMineDeBarbakPresenterService {
    exposeStateForUser(state, userId) {
        const meta = this.getMeta(state);
        const hands = meta.hands && typeof meta.hands === 'object' ? meta.hands : {};
        const deck = Array.isArray(meta.deck) ? meta.deck : [];
        const discard = Array.isArray(meta.discard) ? meta.discard : [];
        const actions = _rulebook.getAvailableActions(state, userId);
        const hand = Array.isArray(hands?.[userId]) ? [
            ...hands[userId]
        ] : [];
        const handCounts = (0, _lamalikepresenterhelper.summarizeHandCounts)(hands);
        const panels = (0, _lamalikepresenterhelper.buildLamaLikePanels)({
            hand,
            handCounts,
            discardLabel: 'Puits',
            tableMessage: `Statut: ${state.status ?? 'en attente'}`
        });
        return {
            ...state,
            catalog: {
                phases: [
                    'round'
                ],
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            extras: {
                hand,
                hands,
                domains: meta.domains,
                deckCount: deck.length,
                discardCount: discard.length,
                drawnPlayerId: meta.drawnPlayerId,
                winnerId: meta.winnerId ?? null,
                ui: {
                    panels
                }
            },
            pending: state.pending ?? null
        };
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
};
LaGrandeMineDeBarbakPresenterService = _ts_decorate([
    (0, _common.Injectable)()
], LaGrandeMineDeBarbakPresenterService);
