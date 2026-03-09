"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ZigEtZagPresenterService", {
    enumerable: true,
    get: function() {
        return ZigEtZagPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gamedefinition = require("../definitions/game.definition");
const _zigetzagcards = require("../model/zig-et-zag-cards");
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
let ZigEtZagPresenterService = class ZigEtZagPresenterService {
    exposeStateForUser(state, userId) {
        const meta = state.metadata ?? {};
        const deckCounts = {};
        const initialDeckCounts = meta.initialDeckCounts ?? {};
        const handCounts = (0, _lamalikepresenterhelper.summarizeHandCounts)(meta.playerDecks);
        const panels = (0, _lamalikepresenterhelper.buildLamaLikePanels)({
            hand: [],
            handCounts,
            discardLabel: 'Paquet',
            playMessage: 'Main : (cachée). Espace piocher.',
            tableMessage: `Statut: ${state.status ?? 'en attente'}`
        });
        Object.entries(meta.playerDecks ?? {}).forEach(([key, cards])=>{
            const pid = Number(key);
            deckCounts[pid] = Array.isArray(cards) ? cards.length : 0;
        });
        const playerList = Array.isArray(state.players) ? state.players : [];
        const deckSummary = playerList.map((player)=>{
            const pid = Number(player?.id);
            if (!Number.isFinite(pid)) return null;
            const name = String(player?.username ?? `Joueur ${pid}`).trim() || `Joueur ${pid}`;
            const current = deckCounts[pid] ?? 0;
            const base = initialDeckCounts[pid] ?? current;
            return `${name}: ${current}/${base}`;
        }).filter((line)=>Boolean(line));
        panels.decks = {
            title: 'Cartes',
            message: deckSummary.length ? deckSummary.join('. ') : 'Aucune carte distribuee.'
        };
        const stage = meta.roundState?.stage ?? 'selection';
        const waitingPlayers = meta.roundState?.waitingPlayers ?? [];
        const handRows = [];
        const actions = _rulebook.getAvailableActions(state, userId);
        return {
            ...state,
            catalog: {
                phases: _gamedefinition.ZIG_ET_ZAG_GAME.phaseOrder.map((phase)=>phase.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions, (action)=>this.actionLabel(action)),
            extras: {
                hand: handRows,
                stage,
                waitingPlayers,
                deckCounts,
                lastRound: meta.lastRound ?? null,
                ui: {
                    panels
                }
            },
            pending: state.pending ?? null
        };
    }
    actionLabel(action) {
        const type = String(action.type ?? '').toLowerCase();
        if (type === 'draw_card') {
            return 'Piocher une carte';
        }
        if (type === 'select_card') {
            const cardId = String(action.payload?.cardId ?? '').trim();
            const definition = _zigetzagcards.ZIG_ET_ZAG_CARD_BY_ID[cardId];
            return `Jouer ${definition?.name ?? 'une carte'}`;
        }
        return 'Jouer une carte';
    }
};
ZigEtZagPresenterService = _ts_decorate([
    (0, _common.Injectable)()
], ZigEtZagPresenterService);
