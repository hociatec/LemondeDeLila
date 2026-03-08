"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaPresenter", {
    enumerable: true,
    get: function() {
        return LamaPresenter;
    }
});
const _common = require("@nestjs/common");
const _basepresenterservice = require("../../../engine/abstract/base-presenter.service");
const _lamamodel = require("./model/lama.model");
const _stringvalueutils = require("../../../../common/utils/string-value.utils");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let LamaPresenter = class LamaPresenter extends _basepresenterservice.BasePresenterService {
    sanitizePlayerName(raw) {
        let name = (0, _stringvalueutils.stringOrEmpty)(raw).trim();
        name = name.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (name.startsWith('"') && name.endsWith('"')) {
            name = name.slice(1, -1).trim();
        }
        const lowered = name.toLowerCase();
        if (lowered.endsWith('(zone de jeu)') || lowered.endsWith('(zone de jeux)') || lowered.endsWith('(game zone)')) {
            const openParen = name.lastIndexOf('(');
            if (openParen > 0) {
                name = name.slice(0, openParen).trimEnd();
            }
        }
        return name;
    }
    exposeStateForUser(state, userId) {
        const exposed = this.buildExposedStateForUser(state, userId);
        // The internal game log contains the drawn card label. We redact it for opponents,
        // while still letting the drawing player see what they drew.
        const players = Array.isArray(state.players) ? state.players : [];
        const log = this.redactDrawLogForUser(exposed.log, players, userId);
        return {
            ...exposed,
            log
        };
    }
    isSetup(state) {
        const status = String(state?.status ?? '').toLowerCase().trim();
        const phase = String(state?.phase ?? '').toLowerCase().trim();
        return status === 'setup' || phase === 'setup';
    }
    buildCatalog() {
        return {
            phases: [
                'round'
            ],
            victory: {
                type: 'lowest_score'
            }
        };
    }
    getAvailableActionsForUser(state, userId) {
        const meta = state.metadata ?? {};
        if (this.isSetup(state) || (meta.step ?? '') === 'setup_config') {
            const ownerId = this.resolveSetupOwnerId(state, meta);
            if (ownerId == null || userId !== ownerId) return [];
            return [
                {
                    type: 'lama_set_config',
                    payload: {}
                }
            ];
        }
        if ((meta.step ?? '') === 'round_pause') {
            return [];
        }
        if (!this.isStarted(state)) return [];
        const out = [
            {
                type: 'lama_peek_discard',
                payload: {}
            },
            {
                type: 'lama_quit',
                payload: {}
            }
        ];
        const handValues = ((meta.handsByPlayerId ?? {})[String(userId)] ?? []).filter((v)=>typeof v === 'number' && v >= 1 && v <= _lamamodel.LAMA_VALUE);
        const dropped = Boolean((meta.droppedOutByPlayerId ?? {})[String(userId)]);
        const drawLocked = this.isDrawLocked(meta);
        const sortedHandValues = [
            ...handValues
        ].sort((a, b)=>a - b);
        const current = state.turn?.currentPlayerId ?? null;
        if (current !== userId) {
            // Not your turn: allow browsing hand without sending game-altering actions.
            for (const value of sortedHandValues){
                out.push({
                    type: 'lama_preview',
                    payload: {
                        value
                    }
                });
            }
            return out;
        }
        const step = meta.step ?? 'turn_choice';
        if (step === 'return_token') {
            if (meta.pendingReturnPlayerId !== userId) return [];
            const score = Number((meta.scoresByPlayerId ?? {})[String(userId)] ?? 0);
            if (score >= 1) out.push({
                type: 'lama_return',
                payload: {
                    value: 1
                }
            });
            if (score >= 10) out.push({
                type: 'lama_return',
                payload: {
                    value: 10
                }
            });
            out.push({
                type: 'lama_return',
                payload: {
                    value: 0
                }
            });
            return out;
        }
        if (dropped) return out;
        const top = this.topDiscard(meta);
        if (!top) return out;
        const tracker = meta.turnTracker ?? {
            playerId: current,
            drawn: false,
            played: false
        };
        const asNumberOrNull = (value)=>{
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
                const n = Number(value.trim());
                return Number.isFinite(n) ? n : null;
            }
            return null;
        };
        const asBoolean = (value)=>{
            if (value === true) return true;
            if (value === false) return false;
            if (typeof value === 'number') return value === 1;
            if (typeof value === 'string') {
                const t = value.trim().toLowerCase();
                if (t === 'true' || t === '1' || t === 'yes' || t === 'oui' || t === 'on') return true;
                if (t === 'false' || t === '0' || t === 'no' || t === 'non' || t === 'off') return false;
            }
            return false;
        };
        const trackerPlayerId = asNumberOrNull(tracker?.playerId);
        const isSameTurn = trackerPlayerId === current;
        const trackerDrawn = asBoolean(tracker?.drawn);
        const trackerPlayed = asBoolean(tracker?.played);
        const turnIndex = Number(state.turnIndex ?? 0);
        const lastDrawMap = meta?.lastDrawTurnIndexByPlayerId ?? null;
        const lastDrawIndex = lastDrawMap && typeof lastDrawMap === 'object' ? asNumberOrNull(lastDrawMap[String(userId)]) : null;
        const justDrew = lastDrawIndex != null && lastDrawIndex === turnIndex;
        const alreadyDrew = isSameTurn && trackerDrawn || justDrew;
        // One pending choice per card in hand (including duplicates): ENTER plays the selected card (count=1).
        if (!(isSameTurn && trackerPlayed)) {
            for (const value of sortedHandValues){
                out.push({
                    type: 'lama_play',
                    payload: {
                        value,
                        count: 1
                    }
                });
            }
        }
        if (!drawLocked && (meta.deck ?? []).length > 0 && !alreadyDrew) {
            out.push({
                type: 'draw',
                payload: {}
            });
        }
        out.push({
            type: 'lama_quit',
            payload: {}
        });
        return out;
    }
    buildPendingState(_state, _metadata, _currentPlayerId) {
        return null;
    }
    buildPendingStateForUser(state, metadata, userId, currentPlayerId) {
        if (this.isSetup(state) || (metadata.step ?? '') === 'setup_config') {
            const ownerId = this.resolveSetupOwnerId(state, metadata);
            if (ownerId == null || userId !== ownerId) return null;
            return {
                type: 'config_prompt',
                label: 'Configuration LAMA.',
                playerId: ownerId,
                choices: [],
                data: {
                    title: 'LAMA',
                    actionType: 'lama_set_config',
                    fields: [
                        {
                            key: 'loseAtScore',
                            label: 'Score de défaite (jetons)',
                            kind: 'number',
                            min: 5,
                            max: 200,
                            initialText: String(metadata.loseAtScore ?? 40)
                        },
                        {
                            key: 'roundPauseSeconds',
                            label: 'Pause entre manches (secondes)',
                            kind: 'number',
                            min: 0,
                            max: 120,
                            initialText: String(metadata.roundPauseSeconds ?? 2)
                        },
                        {
                            key: 'allowPlayAfterDraw',
                            label: 'Autoriser de rejouer après une pioche (oui/non)',
                            kind: 'boolean',
                            initialText: metadata.allowPlayAfterDraw ? 'oui' : 'non'
                        },
                        {
                            key: 'allowDrawAfterFirstQuit',
                            label: 'Autoriser la pioche après qu’un joueur s’est retiré (dans la manche) (oui/non)',
                            kind: 'boolean',
                            initialText: metadata.allowDrawAfterFirstQuit ? 'oui' : 'non'
                        },
                        {
                            key: 'returnTokenFromRound',
                            label: 'Manche à partir de laquelle un jeton peut être rendu',
                            kind: 'number',
                            min: 1,
                            max: 50,
                            initialText: String(metadata.returnTokenFromRound ?? 2)
                        }
                    ]
                }
            };
        }
        if ((metadata.step ?? '') === 'round_pause') {
            const until = typeof metadata.roundPauseUntilMs === 'number' ? metadata.roundPauseUntilMs : null;
            const seconds = until != null ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0;
            return {
                type: 'lama_pause',
                label: `Pause entre manches : prochain round dans ~${seconds}s.`,
                playerId: userId,
                choices: []
            };
        }
        if (!this.isStarted(state)) return null;
        // Always expose hand + discard top for the viewer (the server is the source of truth).
        const step = metadata.step ?? 'turn_choice';
        if (step === 'return_token') {
            if (metadata.pendingReturnPlayerId !== userId) return null;
            const score = Number((metadata.scoresByPlayerId ?? {})[String(userId)] ?? 0);
            const choices = [];
            if (score >= 1) choices.push('Rendre 1 jeton');
            if (score >= 10) choices.push('Rendre 1 diamant (10 jetons)');
            choices.push('Ne rien rendre');
            return {
                type: 'lama_return',
                label: 'Vous avez gagné la manche : rendez 1 jeton ou 1 diamant (10 jetons) si possible.',
                playerId: userId,
                choices
            };
        }
        const hand = (metadata.handsByPlayerId ?? {})[String(userId)] ?? [];
        const droppedOut = Boolean((metadata.droppedOutByPlayerId ?? {})[String(userId)]);
        const drawLocked = this.isDrawLocked(metadata);
        const top = this.topDiscard(metadata);
        if (!top) return null;
        const choices = hand.slice().filter((v)=>typeof v === 'number' && v >= 1 && v <= _lamamodel.LAMA_VALUE).sort((a, b)=>a - b).map(_lamamodel.lamaCardLabel);
        const meScore = Number((metadata.scoresByPlayerId ?? {})[String(userId)] ?? 0);
        const discardTop = (0, _lamamodel.lamaCardLabel)(top);
        const handScore = [
            ...new Set(hand)
        ].reduce((sum, v)=>sum + (0, _lamamodel.lamaCardScore)(v), 0);
        return {
            type: currentPlayerId === userId ? 'lama_turn' : 'lama_hand',
            label: droppedOut ? `Défausse : ${discardTop}. Vous vous êtes retiré de la manche. Main : ${hand.length} cartes (${handScore} jetons). Total : ${meScore} jetons.` : currentPlayerId === userId ? `Défausse : ${discardTop}. Main : ${hand.length} cartes (${handScore} jetons). (${drawLocked ? '↑/↓ choisir, Entrée jouer, P/Q passer, C défausse, E mains, S jetons' : '↑/↓ choisir, Entrée jouer, Espace piocher, P/Q passer, C défausse, E mains, S jetons'})` : `Défausse : ${discardTop}. Main : ${hand.length} cartes (${handScore} jetons). (En attente)`,
            playerId: userId,
            choices
        };
    }
    getActionLabel(actionType) {
        if (actionType === 'lama_play') return 'Jouer';
        if (actionType === 'draw') return 'Piocher';
        if (actionType === 'lama_set_config') return 'Configuration';
        if (actionType === 'lama_quit') return 'Passer (se retirer de la manche)';
        if (actionType === 'lama_pass') return 'Passer (se retirer de la manche)';
        if (actionType === 'lama_return') return 'Rendre jetons';
        if (actionType === 'lama_peek_discard') return 'Voir défausse';
        if (actionType === 'lama_preview') return 'Voir carte';
        return actionType;
    }
    buildExtras(state, _metadata, _currentPlayerId) {
        return this.getBaseExtras(state);
    }
    buildExtrasForUser(state, metadata, userId, currentPlayerId) {
        const base = this.getBaseExtras(state);
        const players = Array.isArray(state.players) ? state.players : [];
        const handValues = (metadata.handsByPlayerId ?? {})[String(userId)] ?? [];
        const hand = handValues.filter((v)=>typeof v === 'number' && v >= 1 && v <= _lamamodel.LAMA_VALUE).sort((a, b)=>a - b).map(_lamamodel.lamaCardLabel);
        const scoreBy = metadata.scoresByPlayerId ?? {};
        const myScore = Number(scoreBy[String(userId)] ?? 0);
        const namesById = new Map();
        players.filter((p)=>typeof p?.id === 'number').forEach((p)=>{
            const pid = p.id;
            namesById.set(pid, this.sanitizePlayerName(p.username) || `Joueur ${pid}`);
        });
        const orderedPlayerIds = players.map((p)=>typeof p?.id === 'number' ? p.id : null).filter((pid)=>pid != null);
        const knownPlayerIdSet = new Set(orderedPlayerIds);
        const orphanScores = Object.entries(scoreBy).filter(([pid])=>!knownPlayerIdSet.has(Number(pid))).map(([, score])=>Number(score)).filter((score)=>Number.isFinite(score));
        const scoreLines = orderedPlayerIds.map((pid)=>{
            const name = namesById.get(pid) || `Joueur ${pid}`;
            const direct = Number(scoreBy[String(pid)]);
            const scoreValue = Number.isFinite(direct) ? direct : orphanScores.length > 0 ? Number(orphanScores.shift()) : 0;
            return `${name}: ${scoreValue}`;
        });
        const discard = Array.isArray(metadata.discard) ? metadata.discard : [];
        const top = discard.length ? discard[discard.length - 1] : null;
        const discardTop = top ? (0, _lamamodel.lamaCardLabel)(top) : '(vide)';
        const drawLocked = this.isDrawLocked(metadata);
        const playableText = (()=>{
            if (this.isSetup(state)) {
                const loseAt = metadata.loseAtScore ?? null;
                return loseAt != null ? `Réglages: défaite à ${loseAt} jetons.` : 'Réglages: choisissez le score de défaite, puis Entrée.';
            }
            if (!this.isStarted(state)) return 'Partie non démarrée.';
            if (currentPlayerId !== userId) return "Ce n'est pas votre tour.";
            const step = metadata.step ?? 'turn_choice';
            if (step === 'return_token') return 'Rendez 1 jeton ou 1 diamant (10 jetons) si possible.';
            if (!top) return 'Défausse vide.';
            const allowed = new Set([
                top,
                (0, _lamamodel.nextLamaValue)(top)
            ]);
            const counts = new Map();
            for (const v of handValues){
                counts.set(v, (counts.get(v) ?? 0) + 1);
            }
            const parts = [];
            for (const [value, count] of [
                ...counts.entries()
            ].sort((a, b)=>a[0] - b[0])){
                if (!allowed.has(value)) continue;
                parts.push(`${(0, _lamamodel.lamaCardLabel)(value)}×${count}`);
            }
            return `Défausse : ${discardTop}. (${drawLocked ? '↑/↓ choisir, Entrée jouer, P/Q passer, C défausse, E mains, S score' : '↑/↓ choisir, Entrée jouer, Espace piocher, P/Q passer, C défausse, E mains, S score'})`;
        })();
        return {
            ...base,
            hand,
            score: [
                `Total jetons: ${myScore}`,
                ...scoreLines
            ],
            ui: {
                panels: {
                    hand: {
                        title: 'Main',
                        message: hand.length ? `Main: ${hand.join(', ')}` : 'Main: (vide)'
                    },
                    hands: {
                        title: 'Mains',
                        message: (()=>{
                            const by = metadata.handsByPlayerId ?? {};
                            const parts = players.filter((p)=>p?.id).map((p)=>{
                                const pid = p.id;
                                const name = this.sanitizePlayerName(p.username) || `#${pid}`;
                                const count = Array.isArray(by[String(pid)]) ? by[String(pid)].length : 0;
                                return `${name}: ${count}`;
                            });
                            return parts.length ? `Cartes en main — ${parts.join(', ')}.` : 'Cartes en main : inconnues.';
                        })()
                    },
                    discard: {
                        title: 'Défausse',
                        message: `Défausse : ${discardTop}.`
                    },
                    play: {
                        title: 'À jouer',
                        message: playableText
                    },
                    score: {
                        title: 'Jetons',
                        message: (()=>{
                            if (scoreLines.length === 0) return 'Jetons: inconnus.';
                            const loseAt = metadata.loseAtScore != null ? Number(metadata.loseAtScore) : null;
                            const loseText = loseAt != null && Number.isFinite(loseAt) ? ` Défaite à ${loseAt} jetons.` : '';
                            return `Jetons: ${scoreLines.join(', ')}.${loseText}`;
                        })()
                    },
                    table: {
                        title: 'Table',
                        message: metadata.loseAtScore != null ? `Défaite à ${metadata.loseAtScore} jetons.` : 'Défaite: non configurée.'
                    }
                }
            }
        };
    }
    topDiscard(meta) {
        const discard = meta.discard ?? [];
        const top = discard.length ? discard[discard.length - 1] : null;
        if (!top) return null;
        if (top < 1 || top > _lamamodel.LAMA_VALUE) return null;
        return top;
    }
    isDrawLocked(meta) {
        if (meta.allowDrawAfterFirstQuit) return false;
        return Object.values(meta.droppedOutByPlayerId ?? {}).some((isOut)=>Boolean(isOut));
    }
    redactDrawLogForUser(log, players, userId) {
        if (!Array.isArray(log) || log.length === 0) return Array.isArray(log) ? [
            ...log
        ] : [];
        const normalize = (raw)=>this.sanitizePlayerName(raw);
        const keyOf = (raw)=>normalize(raw).toLowerCase();
        // Build the same label mapping as the game uses when logging actions.
        const idByLabel = new Map();
        for (const p of players){
            const name = normalize(p?.username);
            if (name) idByLabel.set(keyOf(name), p.id);
            idByLabel.set(keyOf(`joueur ${p.id}`), p.id);
        }
        const viewerName = players.find((p)=>p?.id === userId)?.username ?? '';
        const viewerKeys = new Set([
            keyOf(viewerName),
            keyOf(`joueur ${userId}`)
        ].filter((k)=>k.length > 0));
        const drawRe = /^(.+?) pioche un (.+)\.$/;
        return log.map((entry)=>{
            const msg = String(entry?.message ?? '').trim();
            const m = msg.match(drawRe);
            if (!m) return entry;
            const actorLabel = normalize(m[1]);
            const actorKey = keyOf(actorLabel);
            const actorId = idByLabel.get(actorKey) ?? null;
            // Keep the full info for the drawing player (even if ids mismatch, use label as fallback).
            if (actorId === userId || actorKey && viewerKeys.has(actorKey)) return entry;
            return {
                ...entry,
                message: `${actorLabel} pioche une carte.`
            };
        });
    }
    resolveSetupOwnerId(state, metadata) {
        const players = Array.isArray(state?.players) ? state.players : [];
        const playerExists = (id)=>typeof id === 'number' && players.some((p)=>Number(p?.id) === id);
        const isBot = (id)=>players.some((p)=>Number(p?.id) === id && p?.isBot === true);
        const metaOwner = metadata?.ownerPlayerId ?? null;
        if (playerExists(metaOwner) && !isBot(metaOwner)) {
            return metaOwner;
        }
        const pendingOwner = Number(state?.pending?.playerId ?? NaN);
        if (Number.isFinite(pendingOwner) && playerExists(pendingOwner) && !isBot(pendingOwner)) {
            return pendingOwner;
        }
        const turnOwner = state?.turn?.currentPlayerId ?? null;
        if (playerExists(turnOwner) && !isBot(turnOwner)) {
            return turnOwner;
        }
        const firstHuman = players.find((p)=>p?.id != null && p?.isBot !== true);
        if (typeof firstHuman?.id === 'number') {
            return firstHuman.id;
        }
        return typeof players[0]?.id === 'number' ? players[0].id : null;
    }
};
LamaPresenter = _ts_decorate([
    (0, _common.Injectable)()
], LamaPresenter);
