"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CatPattesPresenterService", {
    enumerable: true,
    get: function() {
        return CatPattesPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gamedefinition = require("../definitions/game.definition");
const _catpattescards = require("../model/cat-pattes-cards");
const _catpattesstateentity = require("../model/cat-pattes-state.entity");
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
let CatPattesPresenterService = class CatPattesPresenterService {
    sanitizePlayerName(raw) {
        return (0, _stringvalueutils.stringOrEmpty)(raw).trim();
    }
    exposeStateForUser(state, userId) {
        const meta = state.metadata ?? {};
        const goalPattes = (()=>{
            const parsed = Number(meta.goalPattes ?? _catpattesstateentity.CAT_PATTES_GOAL);
            if (!Number.isFinite(parsed)) return _catpattesstateentity.CAT_PATTES_GOAL;
            const rounded = Math.round(parsed);
            if (rounded <= 0) return _catpattesstateentity.CAT_PATTES_GOAL;
            return rounded;
        })();
        const actions = _rulebook.getAvailableActions(state, userId);
        const roundsToPlay = (()=>{
            const parsed = Number(meta.roundsToPlay ?? _catpattesstateentity.CAT_PATTES_DEFAULT_ROUNDS);
            if (!Number.isFinite(parsed)) return _catpattesstateentity.CAT_PATTES_DEFAULT_ROUNDS;
            const rounded = Math.round(parsed);
            if (rounded < 1 || rounded > 20) return _catpattesstateentity.CAT_PATTES_DEFAULT_ROUNDS;
            return rounded;
        })();
        const completedRounds = (()=>{
            const parsed = Number(meta.completedRounds ?? 0);
            if (!Number.isFinite(parsed)) return 0;
            return Math.max(0, Math.trunc(parsed));
        })();
        const basePending = state.pending;
        const pendingForUser = basePending?.type === 'config_prompt' && Number(basePending?.playerId ?? NaN) !== Number(userId) ? null : basePending;
        const pending = this.normalizePending(pendingForUser, actions);
        const handIds = Array.isArray(meta.hands?.[userId]) ? [
            ...meta.hands[userId]
        ] : [];
        const hand = handIds.map((id)=>_catpattescards.CAT_PATTES_CARD_BY_ID[id]?.name ?? id);
        const players = Array.isArray(state.players) ? state.players : [];
        const nameById = {};
        for (const p of players){
            if (!p?.id) continue;
            nameById[p.id] = p?.username && String(p.username).trim() ? String(p.username).trim() : `Joueur ${p.id}`;
        }
        const scoreLines = players.map((p)=>{
            const pid = p?.id;
            const name = nameById[pid] ?? `Joueur ${pid}`;
            const points = Number(meta.points?.[pid] ?? 0);
            return `${name} : ${points} pattes`;
        });
        const progressionLines = players.map((p)=>{
            const pid = p?.id;
            const name = nameById[pid] ?? `Joueur ${pid}`;
            const value = Number(meta.positions?.[pid] ?? 0);
            return `${name} : ${value} pattes / ${goalPattes}.`;
        });
        const obstacleLabels = {
            gamelle: 'Gamelle vide',
            pluie: 'Pluie torrentielle',
            chien: 'Chien enragé',
            coussin: 'Coussin piégé',
            sol: 'Sol ciré'
        };
        const botLabels = {
            reserve: 'Reserve secrete',
            'chat-ninja': 'Chat ninja',
            'patte-blindee': 'Patte blindee',
            'passage-star': 'Passage de star'
        };
        const effectLines = players.map((p)=>{
            const pid = p?.id;
            const name = nameById[pid] ?? `Joueur ${pid}`;
            const obstacle = meta.obstacles?.[pid] ?? null;
            const obstacleLabel = obstacle ? obstacleLabels[obstacle] : null;
            const bots = Array.isArray(meta.bots?.[pid]) ? meta.bots[pid] : [];
            const botNames = bots.map((b)=>botLabels[b] ?? String(b));
            const status = obstacleLabel ? `arrêté par ${obstacleLabel}` : 'libre';
            const immunities = botNames.length ? `, immunités ${botNames.join(', ')}` : '';
            return `${name} : ${status}${immunities}.`;
        });
        const handCounts = Object.entries(meta.hands ?? {}).map(([id, cards])=>`Joueur ${id}: ${Array.isArray(cards) ? cards.length : 0}`).join(' • ');
        const lastDiscardId = Array.isArray(meta.discard) ? meta.discard[meta.discard.length - 1] ?? null : null;
        const lastDiscardName = lastDiscardId && _catpattescards.CAT_PATTES_CARD_BY_ID[lastDiscardId] ? _catpattescards.CAT_PATTES_CARD_BY_ID[lastDiscardId].name : null;
        const extras = {
            hand,
            handIds,
            positions: meta.positions,
            points: meta.points,
            roundsToPlay,
            completedRounds,
            obstacles: meta.obstacles,
            bots: meta.bots,
            hasSun: meta.hasSun,
            pawns: meta.pawns,
            pawnByPlayerId: meta.pawnByPlayerId,
            ui: {
                panels: {
                    hand: {
                        title: 'Main',
                        message: hand.length ? `Main : ${hand.join(', ')}` : 'Main : (vide)'
                    },
                    hands: {
                        title: 'Mains',
                        message: handCounts ? `Mains : ${handCounts}` : 'Mains : (inconnues)'
                    },
                    play: {
                        title: 'À jouer',
                        message: '(↑/↓ choisir, Entrée jouer, Espace piocher, D défausser, C dernière carte, S score, P progression, I infos)'
                    },
                    score: {
                        title: 'Score',
                        message: `${scoreLines.join(', ')}. Manches: ${Math.min(completedRounds, roundsToPlay)}/${roundsToPlay}.`
                    },
                    position: {
                        title: 'Progression',
                        message: progressionLines.join(' ')
                    },
                    discard: {
                        title: 'Dernière carte',
                        message: lastDiscardName ? `Dernière carte jouée : ${lastDiscardName}.` : 'Dernière carte jouée : (aucune).'
                    },
                    info: {
                        title: 'Effets en cours',
                        message: effectLines.length ? effectLines.join('\n') : 'Aucun effet actif.'
                    }
                }
            }
        };
        return {
            ...state,
            log: this.redactDrawLogForUser(state.log, players, userId),
            catalog: {
                phases: _gamedefinition.CAT_PATTES_GAME.phaseOrder.map((phase)=>phase.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            extras,
            pending
        };
    }
    redactDrawLogForUser(log, players, userId) {
        if (!Array.isArray(log) || log.length === 0) {
            return Array.isArray(log) ? [
                ...log
            ] : [];
        }
        const normalize = (raw)=>this.sanitizePlayerName(raw).toLowerCase();
        const idByLabel = new Map();
        for (const p of players){
            const name = this.sanitizePlayerName(p?.username);
            if (name) idByLabel.set(normalize(name), p.id);
            idByLabel.set(normalize(`joueur ${p.id}`), p.id);
        }
        const drawRe = /^(.+?) pioche (.+)\.$/;
        return log.map((entry)=>{
            const message = String(entry?.message ?? '').trim();
            const match = message.match(drawRe);
            if (!match) return entry;
            const actorLabel = this.sanitizePlayerName(match[1]);
            const actorId = idByLabel.get(normalize(actorLabel)) ?? null;
            if (actorId === userId) return entry;
            return {
                ...entry,
                message: `${actorLabel} pioche une carte.`
            };
        });
    }
    normalizePending(pending, actions) {
        if (!pending || typeof pending !== 'object') return pending ?? null;
        const type = String(pending?.type ?? '').trim().toLowerCase();
        if (type !== 'choose_pawn') return pending;
        const rawChoices = Array.isArray(pending?.choices) ? pending.choices : [];
        const normalizedChoices = rawChoices.map((choice)=>(0, _stringvalueutils.stringOrEmpty)(choice).trim()).filter((choice)=>choice.length > 0);
        if (normalizedChoices.length > 0) {
            return {
                ...pending,
                choices: normalizedChoices
            };
        }
        const pendingPawns = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
        const pawnsFromPendingData = pendingPawns.map((pawn)=>(0, _stringvalueutils.stringOrEmpty)(pawn?.label ?? pawn?.id ?? '').trim()).filter((choice)=>choice.length > 0);
        if (pawnsFromPendingData.length > 0) {
            return {
                ...pending,
                choices: pawnsFromPendingData
            };
        }
        const pawnsFromActions = (Array.isArray(actions) ? actions : []).filter((action)=>String(action?.type ?? '').trim().toLowerCase() === 'choose_pawn').map((action)=>{
            const payload = action?.payload ?? {};
            return (0, _stringvalueutils.stringOrEmpty)(payload.pawnId ?? payload.pawn ?? payload.value).trim();
        }).filter((choice)=>choice.length > 0);
        if (pawnsFromActions.length > 0) {
            return {
                ...pending,
                choices: pawnsFromActions
            };
        }
        return pending;
    }
};
CatPattesPresenterService = _ts_decorate([
    (0, _common.Injectable)()
], CatPattesPresenterService);
