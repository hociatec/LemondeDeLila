"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePendingPawnChoiceAction = resolvePendingPawnChoiceAction;
function resolvePendingPawnChoiceAction(params) {
    const pendingType = String(params.pendingType ?? '').trim() || 'choose_pawn';
    const pending = (params.state?.pending ?? null);
    if (!pending || pending.type !== pendingType)
        return null;
    const playerIdRaw = typeof pending.playerId === 'number'
        ? pending.playerId
        : (params.state?.turn?.currentPlayerId ?? null);
    if (typeof playerIdRaw !== 'number' || !Number.isFinite(playerIdRaw)) {
        return null;
    }
    const payload = params.action?.payload && typeof params.action.payload === 'object'
        ? params.action.payload
        : {};
    const rawChoice = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
    const optionsRaw = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
    const options = optionsRaw
        .map((entry) => normalizePawnChoiceOption(entry))
        .filter((entry) => entry !== null);
    const chosen = params.resolveChoice(rawChoice, options);
    if (!chosen)
        return null;
    return {
        playerId: playerIdRaw,
        options,
        chosen,
        pending,
    };
}
function normalizePawnChoiceOption(value) {
    if (!value || typeof value !== 'object')
        return null;
    const record = value;
    const id = toText(record.id);
    if (!id)
        return null;
    const label = toText(record.label) || id;
    const out = { ...record, id, label };
    if (Object.prototype.hasOwnProperty.call(record, 'description')) {
        out.description = toText(record.description);
    }
    return out;
}
function toText(value) {
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    if (typeof value === 'boolean')
        return value ? 'true' : 'false';
    return '';
}
//# sourceMappingURL=pawn-choice-action.helper.js.map