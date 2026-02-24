"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.harmonizeActionStateReturn = harmonizeActionStateReturn;
exports.applyActionPipeline = applyActionPipeline;
exports.normalizeActionType = normalizeActionType;
exports.normalizeLowerActionType = normalizeLowerActionType;
exports.isRollAlias = isRollAlias;
exports.normalizeLegacyRollAliasToUpper = normalizeLegacyRollAliasToUpper;
exports.normalizeRollActionType = normalizeRollActionType;
exports.isRollActionType = isRollActionType;
exports.applyActionsSequentially = applyActionsSequentially;
exports.dispatchByActionType = dispatchByActionType;
const DEFAULT_ACTION_ALIASES = {
    ROLL_DICE: 'roll',
    roll_dice: 'roll',
};
function toActionText(value) {
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value).trim();
    }
    return '';
}
function harmonizeActionStateReturn(state) {
    return {
        ...state,
        pending: state.pending ?? null,
        metadata: state.metadata ?? {},
    };
}
function applyActionPipeline(state, action, handlers) {
    if (handlers.guard && !handlers.guard(state, action)) {
        return state;
    }
    const payload = handlers.validate
        ? handlers.validate(state, action)
        : undefined;
    const transitionResult = handlers.transition(state, action, payload);
    const effectedState = handlers.effects
        ? handlers.effects(state, action, payload, transitionResult)
        : transitionResult;
    return handlers.logs
        ? handlers.logs(state, action, payload, transitionResult, effectedState)
        : effectedState;
}
function normalizeActionType(action) {
    return String(action?.type ?? '').trim();
}
function normalizeLowerActionType(action) {
    return normalizeActionType(action).toLowerCase();
}
function isRollAlias(rawType, normalizedType) {
    const raw = toActionText(rawType);
    if (raw === 'ROLL_DICE' || raw === 'roll_dice')
        return true;
    const normalized = toActionText(normalizedType) || raw.toLowerCase();
    return normalized === 'roll_dice';
}
function normalizeLegacyRollAliasToUpper(rawType) {
    const raw = toActionText(rawType);
    return isRollAlias(raw) ? 'ROLL_DICE' : raw;
}
function normalizeRollActionType(rawType, fallback = 'roll') {
    const raw = toActionText(rawType);
    if (!raw)
        return fallback;
    return isRollAlias(raw) ? fallback : raw;
}
function isRollActionType(rawType, normalizedType) {
    const normalized = normalizeRollActionType(rawType, toActionText(normalizedType) || 'roll');
    return normalized === 'roll' || isRollAlias(rawType, normalizedType);
}
function applyActionsSequentially(state, actions, applier) {
    let next = state;
    for (const action of actions ?? []) {
        next = applier(next, action);
    }
    return next;
}
function dispatchByActionType(type, handlers, fallback) {
    const alias = DEFAULT_ACTION_ALIASES[type];
    const resolvedType = handlers[type]
        ? type
        : alias && handlers[alias]
            ? alias
            : type;
    const handler = handlers[resolvedType];
    return handler ? handler() : fallback();
}
//# sourceMappingURL=action-service.helper.js.map