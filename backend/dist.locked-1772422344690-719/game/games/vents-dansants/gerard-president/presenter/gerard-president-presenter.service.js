"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GerardPresidentPresenterService", {
    enumerable: true,
    get: function() {
        return GerardPresidentPresenterService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gerardpresidentcards = require("../model/gerard-president-cards");
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
const ACTION_LABELS = {
    set_theme: 'Définir un thème',
    play_name: 'Jouer un prénom',
    play_special: 'Jouer une carte spéciale',
    pass: 'Passer',
    choose_winner: 'Choisir le gagnant'
};
let GerardPresidentPresenterService = class GerardPresidentPresenterService {
    exposeStateForUser(state, userId) {
        const metadata = state.metadata ?? {};
        const submissions = metadata.submissions ?? {};
        const sanitizedSubmissions = this.sanitizeSubmissions(submissions, userId);
        const hand = metadata.hands?.[userId] ?? [];
        const specialHand = metadata.specialHands?.[userId] ?? [];
        const handCounts = this.buildHandCounts(metadata.hands);
        const isMaster = metadata.masterId === userId;
        const themeHidden = metadata.themeSecretActive && metadata.masterId != null && !isMaster;
        const currentTheme = themeHidden ? 'Thème secret' : metadata.currentTheme;
        const secondTheme = themeHidden && metadata.secondTheme ? 'Thème secret' : metadata.secondTheme;
        const actions = _rulebook.getAvailableActions(state, userId);
        const catalog = this.buildCatalog();
        const scoreLines = Object.entries(metadata.scores ?? {}).map(([pid, value])=>({
                pid: Number(pid),
                value
            }));
        const panels = (0, _lamalikepresenterhelper.buildLamaLikePanels)({
            hand,
            handCounts,
            discardLabel: 'Soumissions',
            scoreLines: scoreLines.map((entry)=>{
                const playerName = (0, _playernamehelper.resolvePlayerName)(state.players, entry.pid);
                return `${playerName}: ${entry.value ?? 0}`;
            }),
            tableMessage: `Phase : ${metadata.roundPhase ?? 'en attente'}`
        });
        const extras = {
            hand,
            specialHand,
            handCards: this.buildHandCards(hand, specialHand),
            handCounts,
            playerViews: this.buildPlayerViews(state.players),
            submissions: metadata.juryOverrideId ? this.markJuryOverride(sanitizedSubmissions, metadata.juryOverrideId) : sanitizedSubmissions,
            scores: metadata.scores,
            roundPhase: metadata.roundPhase,
            targetScore: metadata.targetScore,
            pendingPlayers: metadata.pendingPlayers,
            ui: {
                panels
            }
        };
        return {
            ...state,
            metadata: {
                ...metadata,
                currentTheme,
                secondTheme,
                hands: {
                    [userId]: [
                        ...hand
                    ]
                },
                specialHands: {
                    [userId]: [
                        ...specialHand
                    ]
                },
                submissions: sanitizedSubmissions
            },
            catalog,
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions, (action)=>ACTION_LABELS[action.type] ?? action.type),
            extras,
            pending: state.pending ?? null
        };
    }
    sanitizeSubmissions(submissions, viewerId) {
        const sanitized = {};
        Object.entries(submissions).forEach(([key, names])=>{
            const playerId = Number(key);
            if (playerId === viewerId) {
                sanitized[playerId] = [
                    ...names ?? []
                ];
            } else {
                sanitized[playerId] = (names ?? []).map(()=>'Prénom secret');
            }
        });
        return sanitized;
    }
    markJuryOverride(submissions, juryId) {
        if (!submissions[juryId]) {
            return submissions;
        }
        return {
            ...submissions,
            [juryId]: submissions[juryId].map((name)=>`${name} (jury)`)
        };
    }
    buildHandCounts(hands) {
        const counts = {};
        Object.entries(hands ?? {}).forEach(([key, values])=>{
            const playerId = Number(key);
            if (!Number.isFinite(playerId)) return;
            counts[playerId] = Array.isArray(values) ? values.length : 0;
        });
        return counts;
    }
    buildCatalog() {
        return {
            phases: [
                'round'
            ],
            victory: null,
            names: _gerardpresidentcards.GERARD_PRESIDENT_NAMES.map((name, index)=>({
                    id: `name-${index}`,
                    name
                })),
            specials: _gerardpresidentcards.GERARD_PRESIDENT_SPECIAL_CARDS.map((card)=>({
                    id: card.id,
                    name: card.name,
                    label: card.description
                })),
            themes: _gerardpresidentcards.GERARD_PRESIDENT_THEMES.map((theme, index)=>({
                    id: `theme-${index}`,
                    name: theme
                }))
        };
    }
    buildHandCards(hand, specialHand) {
        const cards = [
            ...hand.map((card)=>({
                    familyId: 'name',
                    memberId: card,
                    label: card
                })),
            ...specialHand.map((cardId)=>{
                const special = _gerardpresidentcards.GERARD_PRESIDENT_SPECIAL_CARDS.find((card)=>card.id === cardId);
                const label = special ? `${special.name} – ${special.description}` : cardId;
                return {
                    familyId: 'special',
                    memberId: cardId,
                    label
                };
            })
        ];
        return cards;
    }
    buildPlayerViews(players) {
        if (!Array.isArray(players)) return [];
        return players.filter((player)=>typeof player?.id === 'number').map((player)=>({
                id: player.id,
                username: player?.username?.trim() || `Joueur ${player.id}`
            }));
    }
};
GerardPresidentPresenterService = _ts_decorate([
    (0, _common.Injectable)()
], GerardPresidentPresenterService);
