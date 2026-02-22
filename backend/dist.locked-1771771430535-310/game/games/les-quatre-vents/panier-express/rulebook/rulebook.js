"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const game_definition_1 = require("../definitions/game.definition");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const pawn_pending_rulebook_helper_1 = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
function normalizeNumber(value) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n))
        return null;
    return n;
}
function getMeta(state) {
    return (state.metadata ?? {});
}
function getAvailableActions(state, playerId) {
    if ((state.status || '').toLowerCase() === 'finished')
        return [];
    const rawPending = asPendingRecord(state.pending);
    const pendingPlayerId = normalizeNumber(rawPending?.playerId);
    if (rawPending &&
        toBoolean(rawPending.blocking) &&
        pendingPlayerId != null &&
        pendingPlayerId !== playerId) {
        return [];
    }
    if (rawPending &&
        (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending: rawPending,
            actorId: playerId,
            actionType: 'draw',
            samePlayer: (left, right) => normalizeNumber(left) === normalizeNumber(right),
        }).ok) {
        return [{ type: 'draw' }];
    }
    if (rawPending &&
        toText(rawPending.type) === 'choose_pawn' &&
        pendingPlayerId != null &&
        pendingPlayerId === playerId) {
        return (0, pawn_pending_rulebook_helper_1.getPendingPawnActionsForPlayer)(rawPending, playerId, 'choose_pawn');
    }
    if (rawPending &&
        toText(rawPending.type) === 'pick' &&
        pendingPlayerId != null &&
        pendingPlayerId === playerId) {
        return (0, pending_actions_rulebook_helper_1.getPendingIndexedChoiceActionsForPlayer)(rawPending, playerId, {
            pendingType: 'pick',
            actionType: 'pick_choice',
            payloadIndexKey: 'index',
            choicesContainer: 'root',
            choicesKey: 'choices',
            samePlayer: (left, right) => normalizeNumber(left) === normalizeNumber(right),
        });
    }
    if (rawPending &&
        toText(rawPending.type) === 'exchange' &&
        toText(rawPending.step) === 'confirm' &&
        normalizeNumber(rawPending.playerId) === playerId) {
        return [{ type: 'exchange_accept' }, { type: 'exchange_refuse' }];
    }
    if (rawPending &&
        toText(rawPending.type) === 'exchange' &&
        toText(rawPending.step) === 'confirm') {
        return [];
    }
    if (rawPending && toText(rawPending.type) === 'merchant_request') {
        return pendingPlayerId === playerId
            ? [
                { type: 'merchant_request_accept' },
                { type: 'merchant_request_refuse' },
            ]
            : [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId)
        return [];
    const meta = getMeta(state);
    const tiles = Array.isArray(meta.tiles)
        ? meta.tiles
        : [];
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = tiles[pos] ?? null;
    const pendingQuiz = meta.quiz?.pending?.[playerId];
    const hasPendingQuiz = Boolean(pendingQuiz);
    const pending = asPendingRecord(state.pending);
    const pendingPid = normalizeNumber(pending?.playerId);
    const hasPendingExchange = Boolean(pending &&
        toText(pending.type) === 'exchange' &&
        pendingPid != null &&
        pendingPid === playerId &&
        toText(pending.step) !== 'confirm');
    if (hasPendingQuiz) {
        const quizPending = asRecord(pendingQuiz);
        const rawChoices = Array.isArray(quizPending.choices)
            ? quizPending.choices
            : toText(quizPending.answer)
                ? [quizPending.answer]
                : [];
        const choices = rawChoices
            .map((c) => toText(c).trim())
            .filter((c) => c.length > 0);
        return choices.map((answer) => ({
            type: 'answer_quiz',
            payload: { answer },
        }));
    }
    if (hasPendingExchange) {
        const exchangePending = pending;
        if (!exchangePending)
            return [];
        if (toText(exchangePending.step) === 'choose_target') {
            const targets = toRecordArray(exchangePending.targets);
            return targets
                .filter((t) => normalizeNumber(t.targetPlayerId) != null)
                .map((t) => ({
                type: 'exchange_choose_target',
                payload: { targetPlayerId: normalizeNumber(t.targetPlayerId) },
            }));
        }
        if (toText(exchangePending.step) === 'choose_give') {
            const choices = toUnknownArray(exchangePending.giveChoices);
            return choices
                .map((c) => toText(c).trim())
                .filter((c) => c.length > 0)
                .map((give) => ({
                type: 'exchange_choose_give',
                payload: { give },
            }));
        }
        return [];
    }
    const base = (() => {
        switch (tile?.type) {
            case 'quiz':
                return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
            case 'exchange':
                return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
            default:
                return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
        }
    })();
    return base;
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const normalizedType = rawType.toLowerCase();
    const type = rawType;
    const pendingAny = asPendingRecord(state.pending);
    const hasBlockingPending = toBoolean(pendingAny?.blocking);
    const pendingPlayerId = normalizeNumber(pendingAny?.playerId);
    if (hasBlockingPending) {
        const allowedWhileBlocking = new Set([
            'draw',
            'choose_pawn',
            'pick_choice',
            'exchange_choose_target',
            'exchange_choose_give',
            'exchange_accept',
            'exchange_refuse',
            'merchant_request_accept',
            'merchant_request_refuse',
        ]);
        const isAllowed = allowedWhileBlocking.has(normalizedType);
        if (!isAllowed) {
            if (actorId != null &&
                pendingPlayerId != null &&
                actorId !== pendingPlayerId) {
                throw new game_errors_1.PlayerActionError('Une action est déjà en attente.', {
                    gameType: 'panier-express',
                    playerId: actorId,
                    currentPlayerId: state.turn?.currentPlayerId ?? null,
                });
            }
            if ((0, action_service_helper_1.isRollActionType)(rawType, normalizedType)) {
                if (actorId != null) {
                    throw new game_errors_1.PlayerActionError("Vous devez d'abord résoudre l'action en attente.", {
                        gameType: 'panier-express',
                        playerId: actorId,
                    });
                }
                throw new game_errors_1.GameValidationError('Action impossible: une action est en attente.', {
                    gameType: 'panier-express',
                    action: rawType,
                });
            }
        }
    }
    if (!game_definition_1.PANIER_EXPRESS_GAME.actions.includes(type) &&
        !game_definition_1.PANIER_EXPRESS_GAME.actions.includes(normalizedType)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType}`, {
            gameType: 'panier-express',
            action: rawType,
            allowedActions: game_definition_1.PANIER_EXPRESS_GAME.actions,
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (type !== 'exchange_accept' &&
        type !== 'exchange_refuse' &&
        type !== 'choose_pawn' &&
        type !== 'pick_choice' &&
        type !== 'draw') {
        if (current != null && actorId != null && actorId !== current) {
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
                gameType: 'panier-express',
                playerId: actorId,
                currentPlayerId: current,
            });
        }
    }
    const payload = action.payload ?? {};
    if ((0, action_service_helper_1.isRollAlias)(type, normalizedType)) {
        return { ...action, type: 'roll', payload: {} };
    }
    if (type === 'choose_pawn') {
        const pending = asPendingRecord(state.pending);
        const validation = (0, pawn_pending_rulebook_helper_1.validatePendingPawnActionForActor)({
            pending,
            actorId: Number(actorId ?? NaN),
            actionType: type,
            payload,
            pendingType: 'choose_pawn',
        });
        if (!validation.ok && validation.reason === 'not_pending_for_actor') {
            throw new game_errors_1.PlayerActionError('Aucun choix en attente.', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
            });
        }
        if (!validation.ok) {
            throw new game_errors_1.GameValidationError('Payload invalide: pawnId', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
                payload,
            });
        }
        return validation.action;
    }
    if (type === 'pick_choice') {
        const pending = asPendingRecord(state.pending);
        const validation = (0, pending_actions_rulebook_helper_1.validatePendingIndexedChoiceActionForActor)({
            pending,
            actorId: Number(actorId ?? NaN),
            actionType: type,
            payload,
            pendingType: 'pick',
            expectedActionType: 'pick_choice',
            payloadIndexKey: 'index',
            choicesContainer: 'root',
            choicesKey: 'choices',
            samePlayer: (left, right) => normalizeNumber(left) === normalizeNumber(right),
        });
        if (!validation.ok && validation.reason === 'not_pending_for_actor') {
            throw new game_errors_1.PlayerActionError('Aucun choix en attente.', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
            });
        }
        if (!validation.ok) {
            throw new game_errors_1.GameValidationError('Payload invalide: index', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
                payload,
            });
        }
        return validation.action;
    }
    if (type === 'answer_quiz') {
        const answer = typeof payload.answer === 'string' ? payload.answer.trim() : '';
        if (!answer) {
            throw new game_errors_1.GameValidationError('Payload invalide: answer', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
                payload,
            });
        }
        return { ...action, type, payload: { answer } };
    }
    if (type === 'exchange_choose_target') {
        const targetPlayerId = normalizeNumber(payload.targetPlayerId);
        if (targetPlayerId == null) {
            throw new game_errors_1.GameValidationError('Payload invalide: targetPlayerId', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
                payload,
            });
        }
        return { ...action, type, payload: { targetPlayerId } };
    }
    if (type === 'exchange_choose_give') {
        const give = toText(payload.give).trim();
        if (!give) {
            throw new game_errors_1.GameValidationError('Payload invalide: give', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
                payload,
            });
        }
        return { ...action, type, payload: { give } };
    }
    if (type === 'exchange_accept' || type === 'exchange_refuse') {
        const pending = asPendingRecord(state.pending);
        const pid = normalizeNumber(pending?.playerId);
        if (!pending ||
            toText(pending.type) !== 'exchange' ||
            toText(pending.step) !== 'confirm' ||
            pid == null ||
            pid !== actorId) {
            throw new game_errors_1.PlayerActionError('Aucun échange à confirmer.', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
            });
        }
        return { ...action, type, payload: {} };
    }
    if (type === 'merchant_request_accept' ||
        type === 'merchant_request_refuse') {
        const pending = asPendingRecord(state.pending);
        const pid = normalizeNumber(pending?.playerId);
        if (!pending ||
            toText(pending.type) !== 'merchant_request' ||
            pid == null ||
            pid !== actorId) {
            throw new game_errors_1.PlayerActionError('Aucune demande du marchand en attente.', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
            });
        }
        return { ...action, type, payload: {} };
    }
    if (type === 'draw') {
        const pending = asPendingRecord(state.pending);
        const drawValidation = (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending,
            actorId: Number(actorId ?? NaN),
            actionType: 'draw',
            samePlayer: (left, right) => normalizeNumber(left) === normalizeNumber(right),
        });
        if (!drawValidation.ok) {
            throw new game_errors_1.PlayerActionError('Aucune pioche en attente.', {
                gameType: 'panier-express',
                playerId: actorId ?? undefined,
            });
        }
        return { ...action, type: 'draw', payload: {} };
    }
    if (type === 'skip_turn') {
        const playerId = actorId ?? normalizeNumber(payload.playerId);
        if (playerId == null) {
            throw new game_errors_1.GameValidationError('Payload invalide: playerId', {
                gameType: 'panier-express',
                payload,
            });
        }
        return { ...action, type, payload: { playerId } };
    }
    if (type === 'roll') {
        if (actorId != null) {
            const meta = getMeta(state);
            const pendingQuiz = meta.quiz?.pending?.[actorId];
            if (pendingQuiz) {
                throw new game_errors_1.PlayerActionError('Vous devez répondre au quiz.', {
                    gameType: 'panier-express',
                    playerId: actorId,
                });
            }
            const pending = asPendingRecord(state.pending);
            if (pending && toText(pending.type) === 'exchange') {
                throw new game_errors_1.PlayerActionError("Vous devez terminer l'échange en cours.", {
                    gameType: 'panier-express',
                    playerId: actorId,
                });
            }
        }
        if (hasBlockingPending) {
            if (actorId != null) {
                throw new game_errors_1.PlayerActionError("Vous devez d'abord résoudre l'action en attente.", {
                    gameType: 'panier-express',
                    playerId: actorId,
                });
            }
            throw new game_errors_1.GameValidationError('Action impossible: une action est en attente.', {
                gameType: 'panier-express',
                action: rawType,
            });
        }
        return { ...action, type, payload: {} };
    }
    return { ...action, type };
}
function asPendingRecord(value) {
    if (value == null || typeof value !== 'object')
        return null;
    return value;
}
function asRecord(value) {
    if (value == null || typeof value !== 'object')
        return {};
    return value;
}
function toUnknownArray(value) {
    return Array.isArray(value) ? value : [];
}
function toRecordArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => item != null && typeof item === 'object');
}
function toText(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
function toBoolean(value) {
    return value === true;
}
//# sourceMappingURL=rulebook.js.map