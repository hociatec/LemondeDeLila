"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanierExpressPresenterService = void 0;
const common_1 = require("@nestjs/common");
const sanitize_text_1 = require("../../../../../common/utils/sanitize-text");
const panier_express_utils_service_1 = require("../model/panier-express-utils.service");
const rules_definition_1 = require("../definitions/rules.definition");
const victory_definition_1 = require("../definitions/victory.definition");
const base_presenter_service_1 = require("../../../../engine/abstract/base-presenter.service");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
let PanierExpressPresenterService = class PanierExpressPresenterService extends base_presenter_service_1.BasePresenterService {
    utils;
    boardPayload;
    pendingQuizRef;
    rawPendingRef = null;
    constructor(utils, boardPayload) {
        super();
        this.utils = utils;
        this.boardPayload = boardPayload;
    }
    exposeState(params) {
        const { state, actions, rawPending, pendingQuiz } = params;
        this.pendingQuizRef = pendingQuiz;
        this.rawPendingRef = rawPending;
        const meta = this.getPanierMeta(state);
        const currentId = params.currentId ?? null;
        const pending = this.buildPendingState(state, meta, currentId);
        const extras = this.buildExtras(state, meta, currentId);
        const catalog = this.buildCatalog();
        return {
            ...state,
            catalog,
            actions: this.formatActions(Array.isArray(actions) ? actions : []),
            pending,
            extras,
            board: {
                ...this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions, meta.laps),
                turns: this.buildBoardTurns(state, meta),
            },
        };
    }
    buildCatalog() {
        return {
            phases: rules_definition_1.PANIER_EXPRESS_PHASES.map((p) => p.id),
            victory: victory_definition_1.PANIER_EXPRESS_VICTORY,
        };
    }
    buildPendingState(_state, _metadata, currentPlayerId) {
        return this.buildPendingView({
            rawPending: this.rawPendingRef,
            pendingQuiz: this.pendingQuizRef,
            currentId: currentPlayerId,
        });
    }
    buildExtras(state, metadata, currentPlayerId) {
        const playerViews = this.buildPlayerViews(state);
        const reveal = toNumberMap(metadata?.statuses?.revealInventory);
        const sanitizedViews = typeof currentPlayerId === 'number'
            ? playerViews.map((v) => v.id === currentPlayerId
                ? v
                : {
                    ...v,
                    shoppingList: v.shoppingList,
                    basket: [],
                    inventory: reveal[v.id] > 0 ? v.inventory : [],
                })
            : playerViews.map((v) => ({
                ...v,
                shoppingList: v.shoppingList,
                basket: [],
                inventory: reveal[v.id] > 0 ? v.inventory : [],
            }));
        const players = sanitizedViews.map(({ id, username, isBot, pawn, shoppingList, basket, inventory }) => ({
            id,
            username,
            isBot,
            pawn,
            shoppingList,
            basket,
            inventory,
        }));
        return this.buildExtrasView(state, {
            currentId: currentPlayerId,
            playerViews: sanitizedViews,
            players,
            revealInventory: reveal,
            fullPlayerViews: playerViews,
        });
    }
    buildBoardTurns(state, meta) {
        const turns = {};
        (state.players ?? []).forEach((p) => {
            const completed = typeof meta.laps?.[p.id] === 'number' ? meta.laps[p.id] : 0;
            turns[p.id] = Math.max(0, completed + 1);
        });
        return turns;
    }
    buildPendingView(params) {
        const quizPayload = this.normalizeQuizPending(params.pendingQuiz);
        if (quizPayload) {
            return {
                type: 'quiz',
                label: 'Réponses possibles',
                question: quizPayload.question,
                choices: quizPayload.choices,
                playerId: params.currentId,
                blocking: true,
            };
        }
        if (params.rawPending && params.rawPending.type === 'exchange') {
            const exchangePending = asRecord(params.rawPending);
            const exchangePlayerId = toNumber(exchangePending.playerId);
            if (typeof params.currentId === 'number' &&
                exchangePlayerId != null &&
                exchangePlayerId !== params.currentId) {
                return null;
            }
            if (toText(exchangePending.step) === 'choose_target') {
                const targets = toExchangeTargetArray(exchangePending.targets);
                const choices = targets
                    .map((t) => (0, sanitize_text_1.sanitizeText)(t.targetUsername))
                    .filter((c) => c.length > 0);
                return {
                    type: 'exchange',
                    playerId: exchangePlayerId,
                    blocking: true,
                    question: "Choisir un joueur pour l'échange.",
                    choices,
                    data: { step: 'choose_target', targets },
                };
            }
            if (toText(exchangePending.step) === 'choose_give') {
                const giveChoices = toUnknownArray(exchangePending.giveChoices);
                const choices = giveChoices
                    .map((c) => this.utils.formatCourseLabel((0, sanitize_text_1.sanitizeText)(toText(c))))
                    .filter((c) => c.length > 0);
                const targetUsername = (0, sanitize_text_1.sanitizeText)(toText(exchangePending.targetUsername));
                return {
                    type: 'exchange',
                    playerId: exchangePlayerId,
                    targetPlayerId: toNumber(exchangePending.targetPlayerId),
                    blocking: true,
                    question: targetUsername
                        ? `Choisir une carte à donner à ${targetUsername}.`
                        : 'Choisir une carte à donner.',
                    choices,
                    data: {
                        step: 'choose_give',
                        targetPlayerId: toNumber(exchangePending.targetPlayerId),
                        targetUsername: toText(exchangePending.targetUsername) || null,
                    },
                };
            }
            if (toText(exchangePending.step) === 'confirm') {
                const initiator = (0, sanitize_text_1.sanitizeText)(toText(exchangePending.initiatorUsername));
                const give = this.utils.formatCourseLabel((0, sanitize_text_1.sanitizeText)(toText(exchangePending.give)));
                const take = exchangePending.take != null
                    ? this.utils.formatCourseLabel((0, sanitize_text_1.sanitizeText)(toText(exchangePending.take)))
                    : '';
                const question = take
                    ? `${initiator} vous propose un échange : il vous donne "${give}" et vous lui donnez "${take}". (A = accepter, R = refuser)`
                    : `${initiator} vous propose un échange : il vous donne "${give}". (A = accepter, R = refuser)`;
                return {
                    type: 'exchange',
                    playerId: exchangePlayerId,
                    blocking: true,
                    question,
                    choices: ['Accepter', 'Refuser'],
                    data: { step: 'confirm' },
                };
            }
        }
        if (params.rawPending &&
            params.rawPending.type &&
            params.rawPending.type !== 'quiz') {
            const pendingRecord = asRecord(params.rawPending);
            const rawChoices = Array.isArray(pendingRecord.choices)
                ? pendingRecord.choices
                : null;
            if (!rawChoices) {
                return params.rawPending;
            }
            return {
                ...params.rawPending,
                choices: rawChoices
                    .map((c) => this.utils.formatCourseLabel((0, sanitize_text_1.sanitizeText)(toText(c))))
                    .filter((c) => c.length > 0),
            };
        }
        return null;
    }
    normalizeQuizPending(pendingQuiz) {
        if (!pendingQuiz) {
            return null;
        }
        const question = (0, sanitize_text_1.sanitizeText)(pendingQuiz.question ?? '');
        const rawChoices = Array.isArray(pendingQuiz.choices) && pendingQuiz.choices.length
            ? pendingQuiz.choices
            : pendingQuiz.answer
                ? [pendingQuiz.answer]
                : [];
        const choices = rawChoices
            .map((choice) => this.utils.formatCourseLabel((0, sanitize_text_1.sanitizeText)(String(choice))))
            .filter((choice) => choice.length > 0);
        if (!question && choices.length === 0) {
            return null;
        }
        return { question, choices };
    }
    buildPlayerViews(state) {
        return (state.players ?? [])
            .map((p) => toPanierPlayerLike(p))
            .filter((p) => p != null)
            .map((p) => this.buildPlayerView(p))
            .filter((view) => Boolean(view));
    }
    buildPlayerView(player) {
        return {
            id: player.id,
            username: typeof player.username === 'string' ? player.username : null,
            isBot: player.isBot === true,
            pawn: typeof player.pawn === 'string' ? player.pawn : null,
            shoppingList: this.utils.formatCourseLabels(this.toStringArray(player.shoppingList)),
            basket: this.utils.formatCourseLabels(this.toStringArray(player.basket)),
            inventory: this.utils.formatCourseLabels(this.toStringArray(player.inventory)),
        };
    }
    buildExtrasView(state, params) {
        const baseExtras = this.getBaseExtras(state);
        const currentPlayerView = typeof params.currentId === 'number'
            ? (params.playerViews.find((view) => view.id === params.currentId) ??
                null)
            : null;
        const listMessage = (title, items) => {
            const values = Array.isArray(items)
                ? items.map((x) => String(x ?? '').trim()).filter((x) => x.length > 0)
                : [];
            if (values.length === 0)
                return `${title}: (vide)`;
            const max = 12;
            const shown = values.length > max ? values.slice(0, max) : values;
            const body = shown.join(', ');
            return values.length > max
                ? `${title}: ${body}, ... (+${values.length - max})`
                : `${title}: ${body}`;
        };
        const shoppingAllMessage = () => {
            if (!Array.isArray(params.playerViews) ||
                params.playerViews.length === 0) {
                return 'Listes de courses: (aucun joueur).';
            }
            const max = 12;
            const lines = params.fullPlayerViews.map((p) => {
                const name = typeof p.username === 'string' && p.username.trim().length > 0
                    ? p.username.trim()
                    : `Joueur ${p.id}`;
                const items = Array.isArray(p.shoppingList) ? p.shoppingList : [];
                if (items.length === 0) {
                    return `${name} : liste (vide)`;
                }
                const shown = items.length > max ? items.slice(0, max) : items;
                const body = shown.join(', ');
                return items.length > max
                    ? `${name} : liste ${body}, ... (+${items.length - max})`
                    : `${name} : liste ${body}`;
            });
            return lines.join('\n');
        };
        const inventoryAllMessage = () => {
            const currentId = typeof params.currentId === 'number' ? params.currentId : null;
            if (!Array.isArray(params.playerViews) ||
                params.playerViews.length === 0) {
                return 'Inventaires: (aucun joueur).';
            }
            const max = 12;
            const lines = params.playerViews.map((p) => {
                const name = typeof p.username === 'string' && p.username.trim().length > 0
                    ? p.username.trim()
                    : `Joueur ${p.id}`;
                const canSee = currentId != null
                    ? p.id === currentId || params.revealInventory[p.id] > 0
                    : params.revealInventory[p.id] > 0;
                if (!canSee) {
                    return `${name} : inventaire (caché)`;
                }
                const items = Array.isArray(p.inventory) ? p.inventory : [];
                if (items.length === 0) {
                    return `${name} : inventaire (vide)`;
                }
                const shown = items.length > max ? items.slice(0, max) : items;
                const body = shown.join(', ');
                return items.length > max
                    ? `${name} : inventaire ${body}, ... (+${items.length - max})`
                    : `${name} : inventaire ${body}`;
            });
            return lines.join('\n');
        };
        const scoreMessage = () => {
            const views = Array.isArray(params.fullPlayerViews) && params.fullPlayerViews.length
                ? params.fullPlayerViews
                : params.playerViews;
            if (!Array.isArray(views) || views.length === 0) {
                return 'Scores: (aucun joueur).';
            }
            const lines = views.map((p) => {
                const name = typeof p.username === 'string' && p.username.trim().length > 0
                    ? p.username.trim()
                    : `Joueur ${p.id}`;
                const list = Array.isArray(p.shoppingList) ? p.shoppingList : [];
                const basket = Array.isArray(p.basket) ? p.basket : [];
                const total = list.length;
                const done = total > 0 ? basket.filter((item) => list.includes(item)).length : 0;
                return `${name} : ${done}/${total}`;
            });
            return lines.join('\n');
        };
        const meta = this.getPanierMeta(state);
        const positionMessage = this.buildPositionPanelMessage(meta, params.playerViews);
        const quizFeedbackMessage = this.buildQuizFeedbackMessage(meta, params.currentId);
        const panels = {
            shopping: {
                title: 'Shopping list',
                message: listMessage('Shopping list', currentPlayerView?.shoppingList),
            },
            shopping_all: {
                title: 'Shopping list (tous)',
                message: shoppingAllMessage(),
            },
            basket: {
                title: 'Panier',
                message: listMessage('Panier', currentPlayerView?.basket),
            },
            inventory: {
                title: 'Inventaire',
                message: listMessage('Inventaire', currentPlayerView?.inventory),
            },
            inventory_all: {
                title: 'Inventaires (tous)',
                message: inventoryAllMessage(),
            },
            score: {
                title: 'Score',
                message: scoreMessage(),
            },
            position: {
                title: 'Position',
                message: positionMessage,
            },
        };
        if (quizFeedbackMessage) {
            panels.quiz_feedback = {
                title: 'Quiz',
                message: quizFeedbackMessage,
            };
        }
        return {
            ...baseExtras,
            currentPlayerView,
            playerViews: params.playerViews,
            players: params.players,
            ui: {
                panels,
            },
        };
    }
    buildQuizFeedbackMessage(meta, playerId) {
        if (typeof playerId !== 'number') {
            return null;
        }
        return meta.quizOutcome?.[playerId]?.message ?? null;
    }
    buildPositionPanelMessage(meta, playerViews) {
        if (!playerViews.length) {
            return 'Position: (aucun joueur).';
        }
        const totalTiles = Array.isArray(meta.tiles) ? meta.tiles.length : 0;
        const lines = playerViews.map((view) => {
            const name = typeof view.username === 'string' && view.username.trim().length > 0
                ? view.username.trim()
                : `Joueur ${view.id}`;
            const pos = meta.positions?.[view.id];
            const lap = meta.laps?.[view.id];
            const caseNumber = typeof pos === 'number' && Number.isFinite(pos)
                ? Math.max(1, Math.trunc(pos) + 1)
                : null;
            const lapText = typeof lap === 'number' && Number.isFinite(lap)
                ? `tour plateau ${Math.trunc(lap)}`
                : 'tour plateau ?';
            const caseText = caseNumber
                ? totalTiles
                    ? `case ${caseNumber}/${totalTiles}`
                    : `case ${caseNumber}`
                : 'case (inconnue)';
            return `${name} : ${lapText}, ${caseText}.`;
        });
        return lines.join('\n');
    }
    toStringArray(value) {
        if (Array.isArray(value)) {
            return value.map((v) => toText(v)).filter((v) => v.length > 0);
        }
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    return parsed.map((v) => toText(v)).filter((v) => v.length > 0);
                }
            }
            catch {
            }
            return value
                .split(/[,;]+/)
                .map((v) => v.trim())
                .filter((v) => v.length > 0);
        }
        return [];
    }
    getPanierMeta(state) {
        return (this.getMetadata(state) ?? {});
    }
};
exports.PanierExpressPresenterService = PanierExpressPresenterService;
exports.PanierExpressPresenterService = PanierExpressPresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [panier_express_utils_service_1.PanierExpressUtils,
        board_payload_service_1.BoardPayloadService])
], PanierExpressPresenterService);
function asRecord(value) {
    if (value == null || typeof value !== 'object')
        return {};
    return value;
}
function toUnknownArray(value) {
    return Array.isArray(value) ? value : [];
}
function toNumber(value) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function toText(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    return '';
}
function toNumberMap(value) {
    const source = asRecord(value);
    const out = {};
    for (const [key, raw] of Object.entries(source)) {
        const id = toNumber(key);
        const amount = toNumber(raw);
        if (id == null || amount == null)
            continue;
        out[id] = amount;
    }
    return out;
}
function toExchangeTargetArray(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => asRecord(item))
        .map((record) => ({
        targetPlayerId: toNumber(record.targetPlayerId),
        targetUsername: (0, sanitize_text_1.sanitizeText)(toText(record.targetUsername)),
    }))
        .filter((entry) => entry.targetPlayerId != null);
}
function toPanierPlayerLike(value) {
    const record = asRecord(value);
    const id = toNumber(record.id);
    if (id == null)
        return null;
    return {
        id,
        username: typeof record.username === 'string' ? record.username : undefined,
        isBot: record.isBot === true,
        pawn: typeof record.pawn === 'string' ? record.pawn : undefined,
        shoppingList: record.shoppingList,
        basket: record.basket,
        inventory: record.inventory,
    };
}
//# sourceMappingURL=panier-express-presenter.service.js.map