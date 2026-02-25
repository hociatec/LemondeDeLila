"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MinuitActionService", {
    enumerable: true,
    get: function() {
        return MinuitActionService;
    }
});
const _common = require("@nestjs/common");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _promptpoliciesservice = require("../../../../modules/prompt-policies/services/prompt-policies.service");
const _minuitdefinition = require("../definitions/minuit.definition");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
const MINUIT_PAWNS = [
    'Le Lutin',
    'Le Bonhomme de Neige',
    'La Fée des Flocons',
    'Le Père Noël',
    'Le Renne',
    "Le Petit Bonhomme en Pain d'Épices"
];
const MINUIT_PLAYER_NAME_OPTIONS = {
    coerceNumericIds: true
};
const MINUIT_MAX_LANDING_STEPS = 128;
let MinuitActionService = class MinuitActionService {
    applyActions(state, actions) {
        const next = (0, _actionservicehelper.applyActionsSequentially)(this.ensurePawnSelection(state), actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                pick_pawn: ()=>{
                    next = this.handlePickPawn(next, action);
                    next = this.ensurePawnSelection(next);
                    return next;
                },
                roll: ()=>{
                    next = this.handleRoll(next);
                    return next;
                },
                draw: ()=>{
                    next = this.handleDraw(next);
                    return next;
                },
                answer_quiz: ()=>{
                    next = this.handleAnswerQuiz(next, action);
                    return next;
                },
                choose_target: ()=>{
                    next = this.handleChooseTarget(next, action);
                    return next;
                }
            }, ()=>next);
        });
        return next;
    }
    isBotLike(player, meta) {
        const playerRecord = asRecord(player);
        if (!playerRecord) return false;
        if (playerRecord.isBot === true) return true;
        const id = Number(playerRecord.id);
        if (Number.isFinite(id) && id < 0) return true;
        if (Number.isFinite(id) && Array.isArray(meta?.botPlayerIds) && meta.botPlayerIds.includes(id)) {
            return true;
        }
        const username = typeof playerRecord.username === 'string' ? playerRecord.username.toLowerCase() : '';
        return username.includes('bot');
    }
    hasPawnAssigned(player, meta) {
        const playerRecord = asRecord(player);
        const playerId = Number(playerRecord.id);
        if (!Number.isFinite(playerId)) return false;
        const playerPawn = typeof playerRecord.pawn === 'string' ? playerRecord.pawn.trim() : '';
        if (playerPawn.length > 0) return true;
        const metaPawn = String((meta.pawns ?? {})[playerId] ?? '').trim();
        return metaPawn.length > 0;
    }
    handleRoll(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const meta0 = this.getMeta(state);
        if (meta0.pendingQuiz || state.pending) return state;
        let meta = meta0;
        // "Piochez à nouveau une carte au lieu de lancer le dé" (tour suivant).
        if (meta.statuses?.forceDrawNextTurn?.[currentId] === true) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    forceDrawNextTurn: {
                        ...meta.statuses.forceDrawNextTurn ?? {},
                        [currentId]: false
                    }
                }
            };
            let next = {
                ...state,
                lastRoll: 0,
                metadata: {
                    ...state.metadata ?? {},
                    ...meta
                }
            };
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId, MINUIT_PLAYER_NAME_OPTIONS)} pioche une carte au lieu de lancer le dé.`);
            return {
                ...next,
                pending: {
                    type: 'draw',
                    playerId: currentId,
                    blocking: true,
                    label: 'Piocher une carte Noël (Espace).',
                    data: {
                        context: 'force_draw'
                    }
                }
            };
        }
        const rng = this.random.rollDice(meta, 6);
        meta = {
            ...meta,
            ...rng.meta
        };
        const roll = rng.roll;
        let next = {
            ...state,
            lastRoll: roll,
            metadata: {
                ...state.metadata ?? {},
                ...meta
            }
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId, MINUIT_PLAYER_NAME_OPTIONS)} lance le dé : "${roll}".`);
        next = this.move(next, currentId, roll);
        next = this.applyLanding(next, currentId);
        meta = this.getMeta(next);
        if (meta.winnerId != null) return {
            ...next,
            status: 'finished'
        };
        if (meta.pendingQuiz || next.pending) return next;
        return this.advanceTurnOrKeep(next, currentId);
    }
    handleDraw(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const pending = state.pending;
        if (!pending || pending.type !== 'draw') return state;
        const currentId = typeof pending.playerId === 'number' ? pending.playerId : state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let next = {
            ...state,
            pending: null
        };
        next = this.applyDrawCard(next, currentId);
        const meta = this.getMeta(next);
        if (meta.winnerId != null) return {
            ...next,
            status: 'finished'
        };
        if (meta.pendingQuiz || next.pending) return next;
        return this.advanceTurnOrKeep(next, currentId);
    }
    applyDrawCard(state, playerId) {
        let next = state;
        let meta = this.getMeta(next);
        const draw = this.drawCard(meta);
        meta = draw.meta;
        next = {
            ...next,
            metadata: {
                ...next.metadata ?? {},
                ...meta
            }
        };
        if (!draw.card) return next;
        const effectText = this.formatCardEffect(draw.card);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} pioche "${draw.card.title}".`);
        if (effectText) {
            next = this.core.appendLog(next, effectText);
        }
        return this.applyCard(next, playerId, draw.card);
    }
    handleAnswerQuiz(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let meta = this.getMeta(state);
        const pending = meta.pendingQuiz ?? null;
        if (!pending || pending.playerId !== currentId) return state;
        const answer = toText(asRecord(action.payload).answer).trim();
        const correct = pending.anyCorrect === true ? true : (pending.answer ?? '').trim().toLowerCase() === answer.toLowerCase();
        let next = state;
        const who = (0, _playernamehelper.resolvePlayerNameFromState)(next, currentId, MINUIT_PLAYER_NAME_OPTIONS);
        if (correct) {
            const delta = typeof pending.successDelta === 'number' ? pending.successDelta : 0;
            next = this.core.appendLog(next, `${who} a choisi la bonne réponse !`);
            if (delta > 0) {
                next = this.move(next, currentId, delta);
            }
        } else {
            next = this.core.appendLog(next, `${who} a validé la mauvaise réponse.`);
            const failDelta = typeof pending.failureDelta === 'number' ? pending.failureDelta : 0;
            if (failDelta !== 0) {
                next = this.move(next, currentId, failDelta);
            }
        }
        meta = this.getMeta(next);
        meta = {
            ...meta,
            pendingQuiz: null
        };
        next = {
            ...next,
            metadata: {
                ...next.metadata ?? {},
                ...meta
            }
        };
        next = this.applyLanding(next, currentId);
        meta = this.getMeta(next);
        if (meta.winnerId != null) return {
            ...next,
            status: 'finished'
        };
        if (meta.pendingQuiz || next.pending) return next;
        return this.advanceTurnOrKeep(next, currentId);
    }
    handleChooseTarget(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const pending = state.pending;
        if (!pending || pending.type !== 'choose_target' || pending.playerId !== currentId) return state;
        const targetPlayerId = Number(asRecord(action.payload).targetPlayerId);
        if (!Number.isFinite(targetPlayerId)) return state;
        let meta = this.getMeta(state);
        const ctx = meta.pendingContext ?? null;
        if (!ctx || ctx.actorId !== currentId) return {
            ...state,
            pending: null
        };
        const actorPos = meta.positions?.[currentId] ?? 0;
        const targetPos = meta.positions?.[targetPlayerId] ?? 0;
        if (ctx.kind === 'swap') {
            meta = {
                ...meta,
                positions: {
                    ...meta.positions ?? {},
                    [currentId]: targetPos,
                    [targetPlayerId]: actorPos
                }
            };
            let next = {
                ...state,
                pending: null,
                metadata: {
                    ...state.metadata ?? {},
                    ...meta,
                    pendingContext: null
                }
            };
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId, MINUIT_PLAYER_NAME_OPTIONS)} échange sa position avec ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetPlayerId, MINUIT_PLAYER_NAME_OPTIONS)}.`);
            return this.advanceTurnOrKeep(next, currentId);
        }
        if (ctx.kind === 'gift') {
            let next = {
                ...state,
                pending: null,
                metadata: {
                    ...state.metadata ?? {},
                    ...meta,
                    pendingContext: null
                }
            };
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId, MINUIT_PLAYER_NAME_OPTIONS)} offre un cadeau à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetPlayerId, MINUIT_PLAYER_NAME_OPTIONS)}.`);
            next = this.move(next, targetPlayerId, 1);
            next = this.move(next, currentId, 2);
            next = this.applyLanding(next, currentId);
            const nextMeta = this.getMeta(next);
            if (nextMeta.pendingQuiz || next.pending) return next;
            return this.advanceTurnOrKeep(next, currentId);
        }
        return {
            ...state,
            pending: null
        };
    }
    ensurePawnSelection(state) {
        const status = (state.status ?? '').toLowerCase();
        const players = Array.isArray(state.players) ? state.players : [];
        const meta = this.getMeta(state);
        if (players.length < _minuitdefinition.MINUIT_GAME.minPlayers) return state;
        const hasPendingPick = state.pending?.type === 'pick_pawn';
        const needsPawnSelection = players.some((p)=>!!p && !this.isBotLike(p, meta) && !this.hasPawnAssigned(p, meta));
        const needsBotPawns = players.some((p)=>!!p && this.isBotLike(p, meta) && !this.hasPawnAssigned(p, meta));
        if (status === 'started') {
            // Preserve human pawn-pick chronology in logs:
            // resolve human pending picks first, then auto-assign bot pawns.
            if (needsPawnSelection || hasPendingPick) {
                const queued = this.queuePawnSelection(state);
                if (queued.pending?.type === 'pick_pawn') {
                    return queued;
                }
                if (queued === state) {
                    return state;
                }
                return this.ensurePawnSelection(queued);
            }
            const withBots = needsBotPawns ? this.assignBotPawns(state) : state;
            const withBotsPlayers = Array.isArray(withBots.players) ? withBots.players : [];
            const withBotsMeta = this.getMeta(withBots);
            const stillNeedsBotPawns = withBotsPlayers.some((p)=>!!p && this.isBotLike(p, withBotsMeta) && !this.hasPawnAssigned(p, withBotsMeta));
            if (!stillNeedsBotPawns) {
                return this.restoreStarterAfterPawnSelection(withBots);
            }
            return withBots;
        }
        if (status !== 'starting' && status !== 'setup') return state;
        // Always assign bot pawns early so humans cannot pick them.
        const withBots = this.assignBotPawns(state);
        const readyPlayers = Array.isArray(withBots.players) ? withBots.players : [];
        if (needsPawnSelection) {
            return this.queuePawnSelection(withBots);
        }
        return {
            ...withBots,
            status: 'started',
            turnIndex: readyPlayers.length ? 0 : -1,
            turn: {
                currentPlayerId: readyPlayers[0]?.id ?? null,
                direction: 1
            }
        };
    }
    queuePawnSelection(state) {
        const pending = state.pending;
        const players = Array.isArray(state.players) ? state.players : [];
        const meta = this.getMeta(state);
        if (pending && pending.type === 'pick_pawn') {
            const pendingPlayerId = Number(pending.playerId);
            const pendingPlayer = players.find((p)=>Number(p?.id) === pendingPlayerId);
            if (pendingPlayer && !this.isBotLike(pendingPlayer, meta) && !this.hasPawnAssigned(pendingPlayer, meta)) {
                return state;
            }
        }
        const missingHumans = players.filter((p)=>!!p && !this.isBotLike(p, meta) && !this.hasPawnAssigned(p, meta));
        if (!missingHumans.length) {
            return pending && pending.type === 'pick_pawn' ? {
                ...state,
                pending: null
            } : state;
        }
        const taken = new Set([
            ...players.map((p)=>typeof p?.pawn === 'string' ? String(p.pawn).trim() : '').filter((pawn)=>pawn.length > 0),
            ...Object.values(meta.pawns ?? {}).map((pawn)=>String(pawn ?? '').trim()).filter((pawn)=>pawn.length > 0)
        ]);
        const choiceEntries = this.listPawnChoiceEntries(this.getMeta(state));
        const available = choiceEntries.filter((entry)=>!taken.has(entry.id));
        const entries = available.length ? available : [
            ...choiceEntries
        ];
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players,
            startPlayerId: players[0]?.id ?? null,
            isAssigned: (playerId)=>{
                const player = players.find((p)=>Number(p?.id) === playerId);
                return !player || this.isBotLike(player, meta) || this.hasPawnAssigned(player, meta);
            },
            pendingType: 'pick_pawn',
            pawns: entries.map((entry)=>({
                    id: entry.id,
                    label: entry.label,
                    description: entry.description
                })),
            includeChoiceMapData: true,
            pawnDataMapper: (choice)=>{
                const choiceRecord = asRecord(choice);
                return {
                    id: toText(choiceRecord.id).trim(),
                    label: toText(choiceRecord.label).trim(),
                    description: toText(choiceRecord.description).trim()
                };
            }
        });
        if (!pendingInfo) return state;
        const fallbackTurn = {
            currentPlayerId: pendingInfo.playerId,
            direction: 1
        };
        const existingTurn = state.turn ?? fallbackTurn;
        const withPending = {
            ...state,
            pending: pendingInfo.pending,
            turnIndex: pendingInfo.turnIndex,
            turn: {
                ...existingTurn,
                currentPlayerId: pendingInfo.playerId,
                direction: existingTurn.direction === -1 ? -1 : 1
            }
        };
        return withPending;
    }
    assignBotPawns(state) {
        const players = Array.isArray(state.players) ? state.players : [];
        const meta = this.getMeta(state);
        const assigned = {
            ...meta.pawns ?? {}
        };
        const taken = new Set(Object.values(assigned).map((pawn)=>typeof pawn === 'string' ? pawn.trim() : '').filter((pawn)=>pawn.length > 0));
        let changed = false;
        const assignedBots = [];
        const updatedPlayers = players.map((p)=>{
            if (!p) return p;
            const pawn = typeof p.pawn === 'string' && String(p.pawn).trim().length > 0 ? String(p.pawn).trim() : String(assigned[p.id] ?? '').trim();
            if (!this.isBotLike(p, meta)) {
                if (pawn.length > 0) {
                    assigned[p.id] = pawn;
                    taken.add(pawn);
                }
                return p;
            }
            if (pawn.length > 0) {
                assigned[p.id] = pawn;
                taken.add(pawn);
                return p;
            }
            const available = this.listPawnChoices(meta).find((candidate)=>!taken.has(candidate));
            if (!available) return p;
            taken.add(available);
            assigned[p.id] = available;
            changed = true;
            assignedBots.push({
                id: p.id,
                pawn: available
            });
            return {
                ...p,
                pawn: available
            };
        });
        const metaChanged = !this.arePawnsEqual(meta.pawns, assigned);
        if (!changed && !metaChanged) return state;
        const nextMeta = {
            ...meta,
            pawns: assigned
        };
        let next = {
            ...state,
            players: updatedPlayers,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
        for (const bot of assignedBots){
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, bot.id, MINUIT_PLAYER_NAME_OPTIONS)} choisit le pion: ${this.resolvePawnName(nextMeta, bot.pawn)}.`);
        }
        return next;
    }
    handlePickPawn(state, action) {
        const pending = state.pending;
        if (!pending || pending.type !== 'pick_pawn') return state;
        const playerId = Number(pending.playerId);
        if (!Number.isFinite(playerId)) return state;
        const payload = asRecord(action?.payload ?? {});
        const requestedPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
        const pendingData = asRecord(pending.data);
        const options = Array.isArray(pendingData.pawns) ? pendingData.pawns.map((entry)=>asRecord(entry)) : [];
        const chosen = this.setupFlow.resolvePawnChoice(requestedPawn, options);
        const chosenRecord = asRecord(chosen);
        const resolvedPawn = toText(chosenRecord.id).trim();
        if (!resolvedPawn) return state;
        const players = Array.isArray(state.players) ? state.players : [];
        const takenByOthers = new Set(players.filter((p)=>Number(p?.id) !== playerId).map((p)=>typeof p?.pawn === 'string' ? p.pawn.trim() : '').filter((pawn)=>pawn.length > 0));
        if (takenByOthers.has(resolvedPawn)) return state;
        const updatedPlayers = players.map((p)=>Number(p?.id) === playerId ? {
                ...p,
                pawn: resolvedPawn
            } : p);
        const meta = this.getMeta(state);
        const nextPawns = {
            ...meta.pawns ?? {},
            [playerId]: resolvedPawn
        };
        const resolvedPawnName = this.resolvePawnName(meta, resolvedPawn);
        let next = {
            ...state,
            players: updatedPlayers,
            pending: null,
            metadata: {
                ...state.metadata ?? {},
                ...{
                    ...meta,
                    pawns: nextPawns
                }
            }
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} choisit le pion: ${resolvedPawnName}.`);
        return this.ensurePawnSelection(next);
    }
    listPawnChoices(meta) {
        return this.listPawnChoiceEntries(meta).map((entry)=>entry.id);
    }
    listPawnChoiceEntries(meta) {
        const fromContent = Array.isArray(meta.pawnChoices) ? meta.pawnChoices.map((p)=>{
            const pawn = asRecord(p);
            return {
                id: toText(pawn.id).trim(),
                name: toText(pawn.name).trim(),
                description: toText(pawn.description).trim()
            };
        }).filter((p)=>p.id.length > 0 && p.name.length > 0).map((p)=>({
                id: p.id,
                label: p.description ? `${p.name}: ${p.description}` : p.name,
                description: p.description
            })) : [];
        if (fromContent.length) return fromContent;
        return MINUIT_PAWNS.map((name)=>({
                id: name,
                label: name,
                description: ''
            }));
    }
    arePawnsEqual(a, b) {
        const keys = new Set([
            ...Object.keys(a ?? {}),
            ...Object.keys(b ?? {})
        ]);
        for (const key of keys){
            const ai = a ? a[Number(key)] ?? '' : '';
            const bi = b ? b[Number(key)] ?? '' : '';
            if (ai !== bi) return false;
        }
        return true;
    }
    applyLanding(state, playerId) {
        let next = state;
        for(let step = 0; step < MINUIT_MAX_LANDING_STEPS; step += 1){
            let meta = this.getMeta(next);
            const pos = meta.positions?.[playerId] ?? 0;
            let tile = meta.tiles[pos];
            if (!tile) return next;
            const occupant = this.findOccupant(meta, playerId, pos);
            if (occupant != null) {
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} place ${this.pawnPossessiveLabel(next, playerId)} sur une case occupée : recul d'une case.`);
                next = this.move(next, playerId, -1);
                meta = this.getMeta(next);
                const afterPos = meta.positions?.[playerId] ?? 0;
                tile = meta.tiles[afterPos];
                if (!tile) return next;
            }
            const afterPos = meta.positions?.[playerId] ?? 0;
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} place ${this.pawnPossessiveLabel(next, playerId)} en case ${afterPos + 1} (${tile.title}).`);
            const description = typeof tile.description === 'string' ? tile.description.trim() : '';
            if (description) {
                next = this.core.appendLog(next, description);
            }
            if (afterPos === 55) {
                meta = {
                    ...meta,
                    winnerId: playerId
                };
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} atteint Minuit !`);
                return {
                    ...next,
                    metadata: {
                        ...next.metadata ?? {},
                        ...meta
                    }
                };
            }
            if (tile.type === 'move') {
                const delta = typeof tile.delta === 'number' ? tile.delta : 0;
                const ignore = meta.statuses?.ignoreNextMalus?.[playerId] === true;
                if (ignore && delta < 0) {
                    meta = {
                        ...meta,
                        statuses: {
                            ...meta.statuses,
                            ignoreNextMalus: {
                                ...meta.statuses.ignoreNextMalus ?? {},
                                [playerId]: false
                            }
                        }
                    };
                    next = {
                        ...next,
                        metadata: {
                            ...next.metadata ?? {},
                            ...meta
                        }
                    };
                    return this.core.appendLog(next, 'Malus ignoré.');
                }
                if (delta === 0) return next;
                const beforePos = afterPos;
                next = this.move(next, playerId, delta);
                const movedMeta = this.getMeta(next);
                const movedPos = movedMeta.positions?.[playerId] ?? beforePos;
                if (movedPos === beforePos) return next;
                continue;
            }
            if (tile.type === 'skip') {
                const ignore = meta.statuses?.ignoreNextSkip?.[playerId] === true;
                if (ignore) {
                    meta = {
                        ...meta,
                        statuses: {
                            ...meta.statuses,
                            ignoreNextSkip: {
                                ...meta.statuses.ignoreNextSkip ?? {},
                                [playerId]: false
                            }
                        }
                    };
                    next = {
                        ...next,
                        metadata: {
                            ...next.metadata ?? {},
                            ...meta
                        }
                    };
                    return this.core.appendLog(next, 'Passe ton tour ignoré.');
                }
                const turns = typeof tile.skipTurns === 'number' ? tile.skipTurns : 1;
                const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
                meta = {
                    ...meta,
                    statuses: {
                        ...meta.statuses,
                        skipTurn: {
                            ...meta.statuses.skipTurn ?? {},
                            [playerId]: curr + turns
                        }
                    }
                };
                next = {
                    ...next,
                    metadata: {
                        ...next.metadata ?? {},
                        ...meta
                    }
                };
                return next;
            }
            if (tile.type === 'card') {
                return {
                    ...next,
                    pending: {
                        type: 'draw',
                        playerId,
                        blocking: true,
                        label: 'Piocher une carte Noël (Espace).'
                    }
                };
            }
            return next;
        }
        return this.core.appendLog(next, 'Enchaînement de cases interrompu pour éviter une boucle infinie.');
    }
    applyCard(state, playerId, card) {
        let next = state;
        let meta = this.getMeta(next);
        const text = (card.lines ?? []).join(' ');
        const quiz = this.parseQuizCard(playerId, card);
        if (quiz) {
            meta = {
                ...meta,
                pendingQuiz: quiz
            };
            next = {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
            return next;
        }
        if (/échangez votre position avec un autre joueur/i.test(text)) {
            const targets = this.otherPlayers(next, playerId);
            const pending = {
                type: 'choose_target',
                label: 'Choisissez un joueur dans la liste, puis Entrée.',
                playerId,
                blocking: true,
                choices: targets.map((t)=>t.username),
                data: {
                    targets: targets.map((t)=>({
                            targetPlayerId: t.id,
                            targetUsername: t.username
                        }))
                }
            };
            meta = {
                ...meta,
                pendingContext: {
                    kind: 'swap',
                    actorId: playerId
                }
            };
            return {
                ...next,
                pending,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
        }
        if (/vous offrez un cadeau à un autre joueur/i.test(text)) {
            const targets = this.otherPlayers(next, playerId);
            const pending = {
                type: 'choose_target',
                label: 'Choisissez un joueur dans la liste, puis Entrée.',
                playerId,
                blocking: true,
                choices: targets.map((t)=>t.username),
                data: {
                    targets: targets.map((t)=>({
                            targetPlayerId: t.id,
                            targetUsername: t.username
                        }))
                }
            };
            meta = {
                ...meta,
                pendingContext: {
                    kind: 'gift',
                    actorId: playerId
                }
            };
            return {
                ...next,
                pending,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
        }
        if (/Ignorez la prochaine case malus/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreNextMalus: {
                        ...meta.statuses.ignoreNextMalus ?? {},
                        [playerId]: true
                    }
                }
            };
            next = {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
            return this.core.appendLog(next, 'Protection malus activée.');
        }
        if (/Ignorez la prochaine case.*Passe ton tour/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreNextSkip: {
                        ...meta.statuses.ignoreNextSkip ?? {},
                        [playerId]: true
                    }
                }
            };
            next = {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
            return this.core.appendLog(next, 'Protection « passe ton tour » activée.');
        }
        // Autres joueurs +1 (sauf vous).
        if (/Les autres joueurs avancent de 1 case, sauf vous/i.test(text)) {
            const others = Object.keys(meta.positions ?? {}).map(Number).filter((id)=>Number.isFinite(id) && id !== playerId);
            const updated = {
                ...meta.positions ?? {}
            };
            for (const id of others){
                updated[id] = clamp((updated[id] ?? 0) + 1, 0, 55);
            }
            meta = {
                ...meta,
                positions: updated
            };
            return {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
        }
        // Force pioche au prochain tour (au lieu de lancer le dé).
        if (/Piochez à nouveau une carte au lieu de lancer le dé/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    forceDrawNextTurn: {
                        ...meta.statuses.forceDrawNextTurn ?? {},
                        [playerId]: true
                    }
                }
            };
            next = {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
            return this.core.appendLog(next, 'Au prochain tour, piochez une carte à la place du dé.');
        }
        // Aller à la case neutre la plus proche derrière.
        if (/case neutre la plus proche derrière/i.test(text)) {
            const pos = meta.positions[playerId] ?? 0;
            const prevPos = findPrev(meta.tiles, pos, (t)=>t.type === 'neutral');
            if (prevPos != null) {
                next = this.core.appendLog(next, 'Retour à la case neutre la plus proche derrière.');
                next = this.setPos(next, playerId, prevPos);
                return this.applyLanding(next, playerId);
            }
        }
        const skip = extractSkipTurns(text);
        if (skip > 0) {
            const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    skipTurn: {
                        ...meta.statuses.skipTurn ?? {},
                        [playerId]: curr + skip
                    }
                }
            };
            next = {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} passe ${skip} tour(s).`);
        }
        if (/jusqu['’]à la prochaine Carte Noël/i.test(text)) {
            const nextPos = findNext(meta.tiles, meta.positions[playerId] ?? 0, (t)=>t.type === 'card');
            if (nextPos != null) {
                next = this.setPos(next, playerId, nextPos);
                return this.applyLanding(next, playerId);
            }
        }
        if (/jusqu['’]à la case précédente Carte Noël/i.test(text)) {
            const prevPos = findPrev(meta.tiles, meta.positions[playerId] ?? 0, (t)=>t.type === 'card');
            if (prevPos != null) {
                next = this.core.appendLog(next, "Recule jusqu'à la précédente Carte Noël.");
                next = this.setPos(next, playerId, prevPos);
                return this.applyLanding(next, playerId);
            }
        }
        if (/position avec le joueur juste derrière/i.test(text)) {
            const behind = findBehind(meta.positions, playerId);
            if (behind != null) {
                const actorPos = meta.positions[playerId] ?? 0;
                const behindPos = meta.positions[behind] ?? 0;
                meta = {
                    ...meta,
                    positions: {
                        ...meta.positions,
                        [playerId]: behindPos,
                        [behind]: actorPos
                    }
                };
                next = {
                    ...next,
                    metadata: {
                        ...next.metadata ?? {},
                        ...meta
                    }
                };
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} échange sa position avec ${(0, _playernamehelper.resolvePlayerNameFromState)(next, behind, MINUIT_PLAYER_NAME_OPTIONS)}.`);
                return next;
            }
        }
        if (/Relancez immédiatement le dé/i.test(text) || /Relancez le dé maintenant/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    keepTurn: {
                        ...meta.statuses.keepTurn ?? {},
                        [playerId]: (meta.statuses.keepTurn?.[playerId] ?? 0) + 1
                    }
                }
            };
            next = {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} rejoue.`);
        }
        if (/Lancez le dé et avancez du nombre obtenu/i.test(text)) {
            const rng = this.random.rollDice(meta, 6);
            meta = {
                ...meta,
                ...rng.meta
            };
            next = {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...meta
                }
            };
            next = this.core.appendLog(next, `Bonus : dé = "${rng.roll}".`);
            next = this.move(next, playerId, rng.roll);
            return this.applyLanding(next, playerId);
        }
        const delta = extractMoveDelta(text);
        if (delta !== 0) {
            next = this.move(next, playerId, delta);
            return this.applyLanding(next, playerId);
        }
        return next;
    }
    formatCardEffect(card) {
        const lines = Array.isArray(card.lines) ? card.lines : [];
        const filtered = lines.filter((line)=>!/^si le joueur a la bonne réponse/i.test(String(line ?? '').trim()));
        const withoutChoices = filtered.filter((line)=>!/^[*]?[abc]\)/i.test(String(line ?? '').trim()));
        const isQuiz = filtered.some((line)=>/^[*]?[abc]\)/i.test(String(line ?? '').trim()));
        if (isQuiz) {
            const question = withoutChoices.find((l)=>String(l).includes('?')) ?? withoutChoices[0] ?? '';
            return String(question).trim();
        }
        return withoutChoices.join(' ').trim();
    }
    move(state, playerId, delta) {
        const meta = this.getMeta(state);
        const pos = meta.positions?.[playerId] ?? 0;
        const nextPos = bounce(pos + delta, 55);
        return this.setPos(state, playerId, nextPos);
    }
    setPos(state, playerId, pos) {
        const meta = this.getMeta(state);
        const nextPos = clamp(pos, 0, 55);
        const nextMeta = {
            ...meta,
            positions: {
                ...meta.positions ?? {},
                [playerId]: nextPos
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    drawCard(meta) {
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: Array.isArray(meta.decks?.cards) ? meta.decks.cards : [],
            discard: Array.isArray(meta.decks?.discard) ? meta.decks.discard : [],
            useWholeMetaRng: true,
            discardDrawnCard: true
        });
        return {
            card: draw.card,
            meta: {
                ...draw.meta,
                decks: {
                    cards: Array.isArray(draw.pile) ? [
                        ...draw.pile
                    ] : [],
                    discard: Array.isArray(draw.discard) ? [
                        ...draw.discard
                    ] : []
                }
            }
        };
    }
    parseQuizCard(playerId, card) {
        const lines = Array.isArray(card.lines) ? card.lines : [];
        const choiceLines = lines.filter((l)=>/^[*]?[abc]\)/i.test(l.trim()));
        if (!choiceLines.length) return null;
        const question = (lines.find((l)=>l.includes('?')) ?? lines[0] ?? 'Quiz').trim();
        const choices = choiceLines.map((l)=>l.replace(/^[*]?[abc]\)\s*/i, '').trim());
        const answerLine = choiceLines.find((l)=>l.trim().startsWith('*')) ?? '';
        const answer = answerLine ? answerLine.replace(/^[*]?[abc]\)\s*/i, '').trim() : undefined;
        const anyCorrect = lines.some((l)=>/Les trois réponses sont just(e|es)/i.test(l));
        const fullText = lines.join(' ');
        const successDelta = extractMoveDelta(fullText);
        const failureDelta = extractFailureDelta(fullText);
        return {
            playerId,
            question,
            choices,
            answer,
            anyCorrect,
            successDelta,
            failureDelta
        };
    }
    otherPlayers(state, me) {
        const players = Array.isArray(state.players) ? state.players : [];
        return players.filter((p)=>p?.id != null && p.id !== me).map((p)=>({
                id: p.id,
                username: (0, _playernamehelper.resolvePlayerNameFromState)(state, p.id, MINUIT_PLAYER_NAME_OPTIONS)
            }));
    }
    findOccupant(meta, me, pos) {
        for (const [id, p] of Object.entries(meta.positions ?? {})){
            const pid = Number(id);
            if (!Number.isFinite(pid) || pid === me) continue;
            if ((p ?? 0) === pos) return pid;
        }
        return null;
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
    pawnLabel(state, id) {
        const meta = this.getMeta(state);
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p)=>Number(p?.id) === id);
        const pawnId = String(player?.pawn ?? meta.pawns?.[id] ?? '').trim();
        const pawn = this.resolvePawnName(meta, pawnId);
        if (pawn) return `"${pawn}"`;
        return 'un pion';
    }
    resolvePawnName(meta, pawnIdOrLabel) {
        const rawLabel = pawnIdOrLabel === null || pawnIdOrLabel === undefined ? '' : pawnIdOrLabel;
        const preparedLabel = typeof rawLabel === 'string' || typeof rawLabel === 'number' || typeof rawLabel === 'boolean' ? String(rawLabel) : '';
        const value = preparedLabel.trim();
        if (!value) return '';
        const normalized = value.toLowerCase();
        const choices = Array.isArray(meta.pawnChoices) ? meta.pawnChoices : [];
        for (const pawn of choices){
            const id = String(pawn?.id ?? '').trim();
            const name = String(pawn?.name ?? '').trim();
            if (!id || !name) continue;
            if (id === value || name === value) return name;
            if (id.toLowerCase() === normalized || name.toLowerCase() === normalized) {
                return name;
            }
        }
        const labelName = value.split(':')[0]?.trim();
        return labelName || value;
    }
    pawnPossessiveLabel(state, id) {
        const raw = this.pawnLabel(state, id);
        const inner = String(raw ?? '').trim().replace(/^"(.*)"$/, '$1').trim();
        if (!inner) return '"son pion"';
        const stripped = inner.replace(/^(le|la|les|un|une)\s+/i, '').replace(/^l['’]\s*/i, '').trim();
        const base = this.lowercaseFirst(stripped || inner);
        const feminine = /^(la|une)\s+/i.test(inner);
        const possessive = feminine ? 'sa' : 'son';
        return `"${possessive} ${base}"`;
    }
    lowercaseFirst(value) {
        const text = String(value ?? '').trim();
        if (!text) return text;
        if (text.length === 1) return text.toLowerCase();
        return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    appendTurnAnnouncement(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        return this.getPromptPolicies().appendLogOnce(state, `C'est au tour de ${this.getTurnPolicies().playerName(state, currentId)}.`);
    }
    getTurnPolicies() {
        return this.turnPolicies ?? new _turnpoliciesservice.TurnPoliciesService(this.core);
    }
    getPromptPolicies() {
        return this.promptPolicies ?? new _promptpoliciesservice.PromptPoliciesService(this.core);
    }
    restoreStarterAfterPawnSelection(state) {
        const meta = this.getMeta(state);
        if (meta.starterRestoredAfterPawnSelection === true) {
            return state;
        }
        const players = Array.isArray(state.players) ? state.players : [];
        const starterIdRaw = typeof meta.starterPlayerId === 'number' ? meta.starterPlayerId : Number(meta.starterPlayerId);
        const starterId = Number.isFinite(starterIdRaw) ? Number(starterIdRaw) : null;
        if (starterId == null || !players.some((p)=>Number(p?.id) === starterId)) {
            return {
                ...state,
                metadata: {
                    ...state.metadata ?? {},
                    ...{
                        ...meta,
                        starterRestoredAfterPawnSelection: true
                    }
                }
            };
        }
        const starterIndex = Math.max(0, players.findIndex((p)=>Number(p?.id) === starterId));
        const currentId = state.turn?.currentPlayerId ?? null;
        const nextMeta = {
            ...meta,
            starterRestoredAfterPawnSelection: true
        };
        let next = {
            ...state,
            turnIndex: starterIndex,
            turn: {
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: starterId
            },
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
        if (currentId !== starterId) {
            next = this.appendTurnAnnouncement(next);
        }
        return next;
    }
    advanceTurnOrKeep(state, playerId) {
        const meta = this.getMeta(state);
        const keep = meta.statuses?.keepTurn?.[playerId] ?? 0;
        if (keep > 0) {
            const nextMeta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    keepTurn: {
                        ...meta.statuses.keepTurn ?? {},
                        [playerId]: Math.max(0, keep - 1)
                    }
                }
            };
            return {
                ...state,
                metadata: {
                    ...state.metadata ?? {},
                    ...nextMeta
                }
            };
        }
        const advanced = this.turns.advanceTurn(state);
        return this.appendTurnAnnouncement(advanced);
    }
    constructor(random, turns, core, setupFlow, deckPolicies, turnPolicies, promptPolicies){
        this.random = random;
        this.turns = turns;
        this.core = core;
        this.setupFlow = setupFlow;
        this.deckPolicies = deckPolicies;
        this.turnPolicies = turnPolicies;
        this.promptPolicies = promptPolicies;
    }
};
MinuitActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(5, (0, _common.Optional)()),
    _ts_param(6, (0, _common.Optional)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _setupflowservice.SetupFlowService === "undefined" ? Object : _setupflowservice.SetupFlowService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService,
        typeof _turnpoliciesservice.TurnPoliciesService === "undefined" ? Object : _turnpoliciesservice.TurnPoliciesService,
        typeof _promptpoliciesservice.PromptPoliciesService === "undefined" ? Object : _promptpoliciesservice.PromptPoliciesService
    ])
], MinuitActionService);
function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}
function bounce(target, max) {
    if (target < 0) return 0;
    if (target === max) return max;
    if (target < max) return target;
    const over = target - max;
    return max - over;
}
function extractMoveDelta(text) {
    const parse = (raw)=>{
        const v = raw.trim().toLowerCase();
        const n = Number(v);
        if (Number.isFinite(n)) return n;
        const map = {
            un: 1,
            une: 1,
            deux: 2,
            trois: 3,
            quatre: 4,
            cinq: 5,
            six: 6
        };
        return map[v] ?? 0;
    };
    const forward = text.match(/avancez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i);
    if (forward) return parse(forward[1]);
    const backward = text.match(/reculez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i);
    if (backward) return -parse(backward[1]);
    return 0;
}
function extractFailureDelta(text) {
    const parse = (raw)=>{
        const v = raw.trim().toLowerCase();
        const n = Number(v);
        if (Number.isFinite(n)) return n;
        const map = {
            un: 1,
            une: 1,
            deux: 2,
            trois: 3,
            quatre: 4,
            cinq: 5,
            six: 6
        };
        return map[v] ?? 0;
    };
    const backward = text.match(/sinon[^.]*reculez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i);
    if (backward) return -parse(backward[1]);
    const forward = text.match(/sinon[^.]*avancez?\s+(?:de|d['’])\s*([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+cases?/i);
    if (forward) return parse(forward[1]);
    return 0;
}
function extractSkipTurns(text) {
    if (/Passez trois tours/i.test(text)) return 3;
    if (/Passez deux tours/i.test(text)) return 2;
    if (/Passez un tour/i.test(text)) return 1;
    if (/Passez votre tour/i.test(text) || /Passe ton tour/i.test(text)) return 1;
    if (/Vous passez trois tours/i.test(text)) return 3;
    if (/Vous passez deux tours/i.test(text)) return 2;
    if (/Vous passez un tour/i.test(text)) return 1;
    return 0;
}
function findNext(items, start, predicate) {
    for(let i = start + 1; i < items.length; i += 1){
        if (predicate(items[i])) return i;
    }
    return null;
}
function findPrev(items, start, predicate) {
    for(let i = start - 1; i >= 0; i -= 1){
        if (predicate(items[i])) return i;
    }
    return null;
}
function findBehind(positions, playerId) {
    const entries = Object.entries(positions).map(([id, pos])=>({
            id: Number(id),
            pos: Number(pos)
        }));
    const ranked = entries.filter((e)=>Number.isFinite(e.id)).sort((a, b)=>a.pos - b.pos);
    const idx = ranked.findIndex((e)=>e.id === playerId);
    if (idx <= 0) return null;
    return ranked[idx - 1].id;
}
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function toText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
