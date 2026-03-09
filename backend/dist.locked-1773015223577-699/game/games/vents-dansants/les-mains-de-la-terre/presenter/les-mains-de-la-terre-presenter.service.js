"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LesMainsPresenterService", {
    enumerable: true,
    get: function() {
        return LesMainsPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _lesmainsdelaterrecards = require("../model/les-mains-de-la-terre-cards");
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
const FAMILY_LABELS = {
    tradition: 'Tradition',
    nature: 'Nature',
    mer: 'Mer',
    art: 'Art',
    insolites: 'Insolites',
    innovation: 'Innovation',
    sante: 'Santé'
};
let LesMainsPresenterService = class LesMainsPresenterService {
    exposeStateForUser(state, userId) {
        const meta = state.metadata ?? {};
        const actions = _rulebook.getAvailableActions(state, userId);
        const hand = Array.isArray(meta.hands?.[userId]) ? meta.hands[userId] : [];
        const handCounts = (0, _lamalikepresenterhelper.summarizeHandCounts)(meta.hands);
        const panels = (0, _lamalikepresenterhelper.buildLamaLikePanels)({
            hand,
            handCounts,
            discardLabel: 'Table de métiers',
            tableMessage: `Statut: ${state.status ?? 'en attente'}`
        });
        const familyCatalog = this.buildFamilyCatalog();
        const catalog = {
            phases: _gamedefinition.LES_MAINS_GAME.phaseOrder.map((phase)=>phase.id),
            victory: null,
            ...familyCatalog
        };
        return {
            ...state,
            catalog,
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions, (action)=>this.buildLabel(action)),
            extras: {
                hand,
                handCards: this.buildHandCards(hand),
                catalog,
                deckCount: meta.deck?.length ?? 0,
                completedFamilies: meta.completedFamilies,
                freeRequest: Boolean(meta.freeFamilyRequest?.[userId]),
                statuses: meta.statuses,
                playerViews: this.buildPlayerViews(state.players),
                ui: {
                    panels
                }
            },
            pending: state.pending ?? null
        };
    }
    buildLabel(action) {
        if (action.type === 'request_card') {
            const cardId = (0, _stringvalueutils.stringOrEmpty)(action.payload?.cardId);
            return `Demander ${_lesmainsdelaterrecards.LES_MAINS_CARD_BY_ID[cardId]?.name ?? cardId}`;
        }
        return action.type;
    }
    buildFamilyCatalog() {
        const catalog = {};
        const cards = Object.values(_lesmainsdelaterrecards.LES_MAINS_CARD_BY_ID);
        for (const family of _lesmainsdelaterrecards.LES_MAINS_FAMILIES){
            const members = cards.filter((card)=>card.family === family).map((card)=>({
                    id: card.id,
                    name: `${FAMILY_LABELS[family] ?? family} - ${card.name}`
                }));
            if (members.length) {
                catalog[family] = members;
            }
        }
        return catalog;
    }
    buildHandCards(hand) {
        const cards = hand.map((cardId)=>{
            const card = _lesmainsdelaterrecards.LES_MAINS_CARD_BY_ID[cardId];
            if (!card) {
                return null;
            }
            const familyId = card.family ?? undefined;
            const familyLabel = familyId && FAMILY_LABELS[familyId] || (familyId ?? 'Carte');
            const label = card.name ? `${familyLabel} - ${card.name}` : cardId;
            return {
                familyId,
                memberId: card.id,
                label
            };
        });
        return cards.filter((entry)=>entry !== null);
    }
    buildPlayerViews(players) {
        if (!Array.isArray(players)) return [];
        return players.map((player)=>{
            if (!player?.id) return null;
            const username = typeof player.username === 'string' && player.username.trim().length > 0 ? player.username.trim() : `Joueur ${player.id}`;
            return {
                id: player.id,
                username
            };
        }).filter((view)=>view != null);
    }
};
LesMainsPresenterService = _ts_decorate([
    (0, _common.Injectable)()
], LesMainsPresenterService);
