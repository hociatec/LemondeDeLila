"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GerardPresidentActionService", {
    enumerable: true,
    get: function() {
        return GerardPresidentActionService;
    }
});
const _common = require("@nestjs/common");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _gerardpresidentcards = require("../model/gerard-president-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GerardPresidentActionService = class GerardPresidentActionService {
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)(state, actions, (current, action)=>this.applyAction(current, action));
    }
    applyAction(state, action) {
        const type = (0, _actionservicehelper.normalizeActionType)(action);
        const payload = action.payload ?? {};
        return (0, _actionservicehelper.dispatchByActionType)(type, {
            set_theme: ()=>this.handleSetTheme(state),
            play_name: ()=>this.handlePlayName(state, payload),
            play_special: ()=>this.handlePlaySpecial(state, payload),
            choose_winner: ()=>this.handleChooseWinner(state, payload),
            pass: ()=>this.handlePass(state)
        }, ()=>state);
    }
    handleSetTheme(state) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const players = this.getPlayers(state);
        const metadata = this.cloneMetadata(state);
        if (metadata.masterId != null && metadata.masterId !== playerId) return state;
        if (metadata.roundPhase !== 'waiting_theme') return state;
        const drawn = this.drawCards(metadata, 'themeDeck', 'themeDiscard', 1);
        if (!drawn.length) return state;
        metadata.currentTheme = drawn[0];
        metadata.secondTheme = null;
        metadata.themeSecretActive = false;
        metadata.pendingPlayers = players.map((player)=>player.id).filter((id)=>id != null && id !== playerId);
        metadata.submissions = {};
        metadata.roundPhase = metadata.pendingPlayers.length ? 'collecting_names' : 'choosing_winner';
        metadata.roundNumber = (metadata.roundNumber ?? 0) + 1;
        metadata.juryOverrideId = null;
        metadata.dominoRemaining = 0;
        metadata.ghostNames = [];
        metadata.specialAttackers = {};
        const nextId = metadata.roundPhase === 'collecting_names' ? metadata.pendingPlayers[0] ?? metadata.masterId ?? null : metadata.masterId ?? null;
        let nextState = this.setCurrentPlayer(state, players, nextId);
        nextState = this.appendLog(nextState, `Le Maître du Thème a dévoilé le thème "${metadata.currentTheme}".`);
        return {
            ...nextState,
            metadata
        };
    }
    handlePlayName(state, payload) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const players = this.getPlayers(state);
        const metadata = this.cloneMetadata(state);
        if (metadata.roundPhase !== 'collecting_names') return state;
        if (!metadata.pendingPlayers.includes(playerId)) return state;
        const hand = metadata.hands[playerId] ?? [];
        const requested = Array.isArray(payload.names) ? payload.names : [];
        const allowed = 1 + (metadata.extraNamesAllowed[playerId] ?? 0);
        const distinct = this.filterPlayableNames(requested);
        if (!distinct.length || distinct.length > allowed) return state;
        if (metadata.lockedName && distinct.includes(metadata.lockedName)) return state;
        if (!distinct.every((name)=>hand.includes(name))) return state;
        const removed = [];
        distinct.forEach((name)=>{
            const index = hand.findIndex((item)=>item === name);
            if (index >= 0) {
                removed.push(...hand.splice(index, 1));
            }
        });
        this.addSubmission(metadata, playerId, removed);
        metadata.hands = {
            ...metadata.hands,
            [playerId]: hand
        };
        metadata.pendingPlayers = metadata.pendingPlayers.filter((id)=>id !== playerId);
        metadata.roundPhase = metadata.pendingPlayers.length === 0 ? 'choosing_winner' : 'collecting_names';
        const nextId = metadata.roundPhase === 'collecting_names' ? metadata.pendingPlayers[0] : metadata.masterId ?? metadata.juryOverrideId ?? null;
        metadata.extraNamesAllowed = {
            ...metadata.extraNamesAllowed,
            [playerId]: 0
        };
        const nextState = this.appendLog(this.setCurrentPlayer(state, players, nextId), `Le joueur ${this.formatPlayer(playerId)} a joué ${removed.join(', ')}.`);
        return {
            ...nextState,
            metadata
        };
    }
    handlePlaySpecial(state, payload) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const players = this.getPlayers(state);
        const metadata = this.cloneMetadata(state);
        const cardId = String(payload.cardId ?? '').trim();
        const specialHand = metadata.specialHands[playerId] ?? [];
        const index = specialHand.findIndex((card)=>card === cardId);
        if (index < 0) return state;
        specialHand.splice(index, 1);
        metadata.specialHands = {
            ...metadata.specialHands,
            [playerId]: specialHand
        };
        metadata.specialDiscard = [
            ...metadata.specialDiscard,
            cardId
        ];
        const played = [
            ...metadata.specialsPlayed[playerId] ?? [],
            cardId
        ];
        metadata.specialsPlayed = {
            ...metadata.specialsPlayed,
            [playerId]: played
        };
        const effectMessage = this.applySpecialEffect(metadata, playerId, cardId, payload, players);
        const nextState = this.appendLog(state, effectMessage || `${this.formatPlayer(playerId)} a utilisé une carte spéciale.`);
        return {
            ...nextState,
            metadata
        };
    }
    handleChooseWinner(state, payload) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const players = this.getPlayers(state);
        const metadata = this.cloneMetadata(state);
        if (metadata.roundPhase !== 'choosing_winner') return state;
        const allowedMaster = metadata.masterId == null || metadata.masterId === playerId;
        const juryAllowed = metadata.juryOverrideId === playerId;
        if (!allowedMaster && !juryAllowed) return state;
        const winnerId = payload.winnerId ?? null;
        if (winnerId == null || !players.some((p)=>p.id === winnerId)) return state;
        const winnerScore = (metadata.scores[winnerId] ?? 0) + 1;
        metadata.scores = {
            ...metadata.scores,
            [winnerId]: winnerScore
        };
        metadata.nameDiscard = [
            ...metadata.nameDiscard,
            ...Object.values(metadata.submissions).flat(),
            ...metadata.ghostNames
        ];
        metadata.submissions = {};
        metadata.pendingPlayers = [];
        metadata.roundPhase = 'waiting_theme';
        metadata.currentTheme = null;
        metadata.secondTheme = null;
        metadata.lockedName = null;
        metadata.extraNamesAllowed = {};
        metadata.defenseActive = {};
        metadata.juryOverrideId = null;
        metadata.themeSecretActive = false;
        metadata.dominoRemaining = 0;
        metadata.ghostNames = [];
        metadata.specialAttackers = {};
        const nextMaster = this.getNextPlayer(players, metadata.masterId);
        metadata.masterId = nextMaster;
        let nextState = this.setCurrentPlayer(state, players, nextMaster);
        nextState = this.appendLog(nextState, `${this.formatPlayer(winnerId)} remporte la manche et atteint ${winnerScore} point(s).`);
        if (winnerScore >= metadata.targetScore) {
            metadata.winnerId = winnerId;
            nextState = {
                ...nextState,
                status: 'finished',
                turn: {
                    ...nextState.turn ?? {},
                    direction: nextState.turn?.direction ?? 1,
                    currentPlayerId: null
                }
            };
        }
        return {
            ...nextState,
            metadata
        };
    }
    handlePass(state) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const players = this.getPlayers(state);
        const metadata = this.cloneMetadata(state);
        if (metadata.roundPhase !== 'collecting_names') return state;
        if (!metadata.pendingPlayers.includes(playerId)) return state;
        metadata.pendingPlayers = metadata.pendingPlayers.filter((id)=>id !== playerId);
        metadata.roundPhase = metadata.pendingPlayers.length === 0 ? 'choosing_winner' : 'collecting_names';
        const nextId = metadata.roundPhase === 'collecting_names' ? metadata.pendingPlayers[0] : metadata.masterId ?? metadata.juryOverrideId ?? null;
        const nextState = this.appendLog(this.setCurrentPlayer(state, players, nextId), `${this.formatPlayer(playerId)} passe son tour.`);
        return {
            ...nextState,
            metadata
        };
    }
    // helpers
    cloneMetadata(state) {
        const base = state.metadata ?? {};
        return {
            rng: base.rng,
            nameDeck: Array.isArray(base.nameDeck) ? [
                ...base.nameDeck
            ] : [],
            themeDeck: Array.isArray(base.themeDeck) ? [
                ...base.themeDeck
            ] : [],
            specialDeck: Array.isArray(base.specialDeck) ? [
                ...base.specialDeck
            ] : [],
            nameDiscard: Array.isArray(base.nameDiscard) ? [
                ...base.nameDiscard
            ] : [],
            themeDiscard: Array.isArray(base.themeDiscard) ? [
                ...base.themeDiscard
            ] : [],
            specialDiscard: Array.isArray(base.specialDiscard) ? [
                ...base.specialDiscard
            ] : [],
            hands: this.cloneRecordOfArrays(base.hands),
            specialHands: this.cloneRecordOfArrays(base.specialHands),
            scores: {
                ...base.scores ?? {}
            },
            masterId: base.masterId ?? null,
            currentTheme: base.currentTheme ?? null,
            secondTheme: base.secondTheme ?? null,
            lockedName: base.lockedName ?? null,
            peaceTurnsRemaining: base.peaceTurnsRemaining ?? 0,
            winnerId: base.winnerId ?? null,
            roundNumber: base.roundNumber ?? 0,
            targetScore: base.targetScore ?? 0,
            submissions: this.cloneRecordOfArrays(base.submissions),
            pendingPlayers: Array.isArray(base.pendingPlayers) ? [
                ...base.pendingPlayers
            ] : [],
            roundPhase: base.roundPhase ?? 'waiting_theme',
            specialsPlayed: this.cloneRecordOfArrays(base.specialsPlayed),
            extraNamesAllowed: {
                ...base.extraNamesAllowed ?? {}
            },
            defenseActive: {
                ...base.defenseActive ?? {}
            },
            specialAttackers: this.cloneNumberRecord(base.specialAttackers),
            themeSecretActive: base.themeSecretActive ?? false,
            juryOverrideId: base.juryOverrideId ?? null,
            dominoRemaining: base.dominoRemaining ?? 0,
            ghostNames: Array.isArray(base.ghostNames) ? [
                ...base.ghostNames
            ] : []
        };
    }
    cloneRecordOfArrays(source) {
        const result = {};
        if (!source) return result;
        Object.entries(source).forEach(([key, value])=>{
            const id = Number(key);
            if (Number.isFinite(id)) {
                result[id] = Array.isArray(value) ? [
                    ...value
                ] : [];
            }
        });
        return result;
    }
    cloneNumberRecord(source) {
        const result = {};
        if (!source) return result;
        Object.entries(source).forEach(([key, value])=>{
            const id = Number(key);
            if (Number.isFinite(id)) {
                result[id] = Array.isArray(value) ? [
                    ...value
                ] : [];
            }
        });
        return result;
    }
    addSubmission(metadata, playerId, names) {
        if (!names.length) return;
        const existing = Array.isArray(metadata.submissions[playerId]) ? [
            ...metadata.submissions[playerId]
        ] : [];
        metadata.submissions = {
            ...metadata.submissions,
            [playerId]: [
                ...existing,
                ...names
            ]
        };
    }
    recordSpecialTarget(metadata, targetId, attackerId) {
        const current = Array.isArray(metadata.specialAttackers[targetId]) ? [
            ...metadata.specialAttackers[targetId]
        ] : [];
        metadata.specialAttackers = {
            ...metadata.specialAttackers,
            [targetId]: [
                ...current,
                attackerId
            ]
        };
    }
    applySpecialEffect(metadata, playerId, cardId, payload, players) {
        const definition = _gerardpresidentcards.GERARD_PRESIDENT_SPECIAL_CARDS.find((card)=>card.id === cardId);
        const actorLabel = this.formatPlayer(playerId);
        if (!definition) return `${actorLabel} a joué une carte spéciale.`;
        const resolveTarget = (id)=>{
            if (id == null) return null;
            return players.some((player)=>player.id === id) ? id : null;
        };
        const targetId = resolveTarget(payload.targetPlayerId ?? null);
        const secondaryId = resolveTarget(payload.secondaryTargetId ?? null);
        if (targetId != null) {
            this.recordSpecialTarget(metadata, targetId, playerId);
        }
        switch(definition.effect){
            case 'double-prenom':
                metadata.extraNamesAllowed = {
                    ...metadata.extraNamesAllowed,
                    [playerId]: Math.max(metadata.extraNamesAllowed[playerId] ?? 0, 1)
                };
                return `${actorLabel} peut jouer deux prénoms cette manche.`;
            case 'double-theme':
                {
                    const extra = this.drawCards(metadata, 'themeDeck', 'themeDiscard', 1);
                    if (!extra.length) return `${actorLabel} voulait ajouter un deuxième thème mais la pioche est vide.`;
                    metadata.secondTheme = extra[0];
                    metadata.themeSecretActive = false;
                    return `${actorLabel} ajoute le thème "${extra[0]}" à côté de celui déjà en cours.`;
                }
            case 'interdiction':
                {
                    const name = String(payload.name ?? '').trim();
                    if (!name) return `${actorLabel} n'a pas précisé de prénom interdit.`;
                    metadata.lockedName = name;
                    return `${actorLabel} interdit le prénom "${name}" pour cette manche.`;
                }
            case 'main-fantome':
                {
                    if (targetId == null) return `${actorLabel} devait choisir un joueur.`;
                    const removed = this.removeRandomFromHand(metadata, targetId);
                    this.addSubmission(metadata, targetId, removed);
                    metadata.pendingPlayers = metadata.pendingPlayers.filter((id)=>id !== targetId);
                    metadata.roundPhase = metadata.pendingPlayers.length === 0 ? 'choosing_winner' : 'collecting_names';
                    return `${actorLabel} force ${this.formatPlayer(targetId)} à jouer ${removed.join(', ')}.`;
                }
            case 'defense-totale':
                metadata.defenseActive = {
                    ...metadata.defenseActive,
                    [playerId]: true
                };
                return `${actorLabel} se protège contre un effet ciblé.`;
            case 'echange-force':
                {
                    if (targetId == null) return `${actorLabel} devait choisir un joueur.`;
                    const ownCard = this.removeRandomFromHand(metadata, playerId);
                    const targetCard = this.removeRandomFromHand(metadata, targetId);
                    if (ownCard.length) {
                        metadata.hands = {
                            ...metadata.hands,
                            [targetId]: [
                                ...metadata.hands[targetId] ?? [],
                                ...ownCard
                            ]
                        };
                    }
                    if (targetCard.length) {
                        metadata.hands = {
                            ...metadata.hands,
                            [playerId]: [
                                ...metadata.hands[playerId] ?? [],
                                ...targetCard
                            ]
                        };
                    }
                    return `${actorLabel} échange des prénoms avec ${this.formatPlayer(targetId)}.`;
                }
            case 'panique-generale':
                {
                    players.forEach((player)=>{
                        const removed = this.removeRandomFromHand(metadata, player.id, 3);
                        metadata.nameDiscard = [
                            ...metadata.nameDiscard,
                            ...removed
                        ];
                        const drawn = this.drawCards(metadata, 'nameDeck', 'nameDiscard', removed.length);
                        metadata.hands = {
                            ...metadata.hands,
                            [player.id]: [
                                ...metadata.hands[player.id] ?? [],
                                ...drawn
                            ]
                        };
                    });
                    return `${actorLabel} déclenche une panique générale : tout le monde refait sa main.`;
                }
            case 'sabotage':
                {
                    if (targetId == null) return `${actorLabel} devait viser un adversaire.`;
                    if (metadata.defenseActive[targetId]) {
                        metadata.defenseActive = {
                            ...metadata.defenseActive,
                            [targetId]: false
                        };
                        return `${actorLabel} a tenté un sabotage, mais ${this.formatPlayer(targetId)} était protégé.`;
                    }
                    const removed = this.removeRandomFromHand(metadata, targetId);
                    metadata.nameDiscard = [
                        ...metadata.nameDiscard,
                        ...removed
                    ];
                    return `${actorLabel} sabote ${this.formatPlayer(targetId)} et lui fait perdre ${removed.join(', ') || 'une carte'}.`;
                }
            case 'retour-envoyeur':
                {
                    const attackers = metadata.specialAttackers[playerId] ?? [];
                    const attacker = attackers.shift() ?? null;
                    metadata.specialAttackers = {
                        ...metadata.specialAttackers,
                        [playerId]: attackers
                    };
                    if (attacker == null) return `${actorLabel} n'avait aucun effet à renvoyer.`;
                    const removed = this.removeRandomFromHand(metadata, attacker);
                    metadata.nameDiscard = [
                        ...metadata.nameDiscard,
                        ...removed
                    ];
                    return `${actorLabel} renvoie le sabotage vers ${this.formatPlayer(attacker)}.`;
                }
            case 'theme-secret':
                metadata.themeSecretActive = true;
                return `${actorLabel} garde le thème secret jusqu'au prochain tour.`;
            case 'chuchotement-confus':
                {
                    if (targetId == null) return `${actorLabel} devait choisir un joueur.`;
                    const neighbor = this.findNeighbor(players, targetId);
                    if (neighbor == null) return `${actorLabel} n'a pas trouvé de voisin.`;
                    const first = this.removeRandomFromHand(metadata, targetId);
                    const second = this.removeRandomFromHand(metadata, neighbor);
                    if (first.length) {
                        metadata.hands = {
                            ...metadata.hands,
                            [neighbor]: [
                                ...metadata.hands[neighbor] ?? [],
                                ...first
                            ]
                        };
                    }
                    if (second.length) {
                        metadata.hands = {
                            ...metadata.hands,
                            [targetId]: [
                                ...metadata.hands[targetId] ?? [],
                                ...second
                            ]
                        };
                    }
                    return `${actorLabel} crée de la confusion entre ${this.formatPlayer(targetId)} et ${this.formatPlayer(neighbor)}.`;
                }
            case 'mega-combo':
                metadata.extraNamesAllowed = {
                    ...metadata.extraNamesAllowed,
                    [playerId]: Math.max(metadata.extraNamesAllowed[playerId] ?? 0, 2)
                };
                return `${actorLabel} peut jouer trois prénoms d'un coup.`;
            case 'inversion':
                metadata.pendingPlayers = [
                    ...metadata.pendingPlayers
                ].reverse();
                return `${actorLabel} inverse l'ordre des joueurs encore actifs.`;
            case 'jury-mystere':
                {
                    const target = targetId ?? this.pickRandomPlayer(players, playerId);
                    metadata.juryOverrideId = target;
                    return `${actorLabel} désigne ${this.formatPlayer(target)} comme jury mystère.`;
                }
            case 'effet-domino':
                metadata.pendingPlayers.forEach((id)=>{
                    metadata.extraNamesAllowed = {
                        ...metadata.extraNamesAllowed,
                        [id]: (metadata.extraNamesAllowed[id] ?? 0) + 1
                    };
                });
                return `${actorLabel} déclenche un effet domino : chaque joueur suivant joue un prénom en plus.`;
            case 'prenom-fantome':
                metadata.ghostNames = [
                    ...metadata.ghostNames,
                    'Prénom Fantôme'
                ];
                return `${actorLabel} ajoute un prénom fantôme pour tromper le jury.`;
            case 'inversion-role':
                metadata.masterId = playerId;
                return `${actorLabel} inverse les rôles et devient Maître du Thème pour cette manche.`;
            case 'chaos-temporel':
                metadata.submissions = {};
                metadata.pendingPlayers = players.map((player)=>player.id).filter((id)=>id != null && id !== metadata.masterId);
                metadata.roundPhase = 'collecting_names';
                return `${actorLabel} rembobine le temps : tout le monde rejoue les prénoms.`;
            case 'ultra-sabotage':
                {
                    const targets = [
                        targetId,
                        secondaryId
                    ].filter((id)=>id != null);
                    if (!targets.length) return `${actorLabel} devait choisir une ou deux cibles.`;
                    targets.forEach((id)=>{
                        const removed = this.removeRandomFromHand(metadata, id);
                        metadata.nameDiscard = [
                            ...metadata.nameDiscard,
                            ...removed
                        ];
                    });
                    return `${actorLabel} sabote ${targets.map((id)=>this.formatPlayer(id)).join(' et ')}.`;
                }
            case 'prenom-volant':
                {
                    if (targetId == null) return `${actorLabel} n'a pas ciblé de joueur.`;
                    if (!metadata.hands[playerId]) metadata.hands[playerId] = [];
                    if (!metadata.hands[targetId]?.length) {
                        return `${actorLabel} voulait voler un prénom mais la main ciblée est vide.`;
                    }
                    const stolen = metadata.hands[targetId].shift();
                    metadata.hands = {
                        ...metadata.hands,
                        [playerId]: [
                            ...metadata.hands[playerId] ?? [],
                            stolen
                        ],
                        [targetId]: [
                            ...metadata.hands[targetId]
                        ]
                    };
                    return `${actorLabel} vole un prénom à ${this.formatPlayer(targetId)}.`;
                }
            default:
                return `${actorLabel} active ${definition.name}.`;
        }
    }
    pickRandomPlayer(players, exceptId) {
        const candidates = players.map((player)=>player.id).filter((id)=>id != null && id !== exceptId);
        if (!candidates.length) return null;
        const { index } = this.random.pickIndex({}, candidates.length);
        return candidates[index] ?? null;
    }
    findNeighbor(players, playerId) {
        const ordered = players.map((player)=>player.id);
        const idx = ordered.findIndex((id)=>id === playerId);
        if (idx < 0) return null;
        const neighborIndex = idx + 1 >= ordered.length ? 0 : idx + 1;
        return ordered[neighborIndex] ?? null;
    }
    removeRandomFromHand(metadata, playerId, count = 1) {
        const hand = [
            ...metadata.hands[playerId] ?? []
        ];
        const removed = [];
        let rng = metadata.rng ?? {};
        for(let i = 0; i < count && hand.length; i += 1){
            const { index, meta } = this.random.pickIndex(rng, hand.length);
            rng = meta;
            const card = hand.splice(index, 1)[0];
            if (card) removed.push(card);
        }
        metadata.rng = rng;
        metadata.hands = {
            ...metadata.hands,
            [playerId]: hand
        };
        return removed;
    }
    getPlayers(state) {
        return (state.players ?? []).filter((player)=>Boolean(player?.id));
    }
    setCurrentPlayer(state, players, nextPlayerId) {
        const index = nextPlayerId == null ? state.turnIndex ?? 0 : players.findIndex((player)=>player.id === nextPlayerId);
        return {
            ...state,
            turnIndex: index >= 0 ? index : state.turnIndex ?? 0,
            turn: {
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: nextPlayerId
            }
        };
    }
    appendLog(state, message) {
        return {
            ...state,
            log: [
                ...state.log ?? [],
                {
                    message
                }
            ]
        };
    }
    formatPlayer(playerId) {
        if (playerId == null) return 'un joueur';
        return `Joueur ${playerId}`;
    }
    drawCards(metadata, deckKey, discardKey, count) {
        let deck = [
            ...metadata[deckKey] ?? []
        ];
        let discard = [
            ...metadata[discardKey] ?? []
        ];
        let rng = metadata.rng ?? {};
        const drawn = [];
        while(drawn.length < count){
            const out = this.deckPolicies.drawFromPile({
                meta: {
                    deck,
                    discard,
                    rng
                },
                pile: deck,
                discard,
                rngKey: 'rng',
                discardDrawnCard: false
            });
            rng = out.meta.rng;
            deck = [
                ...out.pile
            ];
            discard = [
                ...out.discard
            ];
            if (!out.card) break;
            drawn.push(out.card);
        }
        metadata[deckKey] = deck;
        metadata[discardKey] = discard;
        metadata.rng = rng;
        return drawn;
    }
    filterPlayableNames(names) {
        const unique = [];
        names.forEach((name)=>{
            const clean = name?.trim();
            if (clean && !unique.includes(clean)) {
                unique.push(clean);
            }
        });
        return unique;
    }
    getNextPlayer(players, currentId) {
        if (!players.length) return null;
        const ordered = players.map((player)=>player.id);
        const currentIndex = currentId != null ? ordered.findIndex((id)=>id === currentId) : -1;
        if (currentIndex < 0 || currentIndex + 1 >= ordered.length) {
            return ordered[0] ?? null;
        }
        return ordered[currentIndex + 1];
    }
    constructor(random, deckPolicies){
        this.random = random;
        this.deckPolicies = deckPolicies;
    }
};
GerardPresidentActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], GerardPresidentActionService);
