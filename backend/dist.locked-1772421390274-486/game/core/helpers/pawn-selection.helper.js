"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get getPendingPawnOptions () {
        return getPendingPawnOptions;
    },
    get isPendingPawnForPlayer () {
        return isPendingPawnForPlayer;
    },
    get listPendingPawnActions () {
        return listPendingPawnActions;
    },
    get resolvePendingPawnId () {
        return resolvePendingPawnId;
    }
});
const _playeridhelper = require("./player-id.helper");
function toText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
function defaultNormalize(value) {
    return value.trim();
}
function normalizeOption(option) {
    const id = toText(option.id).trim();
    if (!id) return null;
    const labelRaw = option.label ?? option.name ?? id;
    const label = toText(labelRaw).trim();
    return {
        id,
        label
    };
}
function isPendingPawnForPlayer(pending, playerId, pendingType = 'choose_pawn') {
    if (!pending || toText(pending.type).trim() !== pendingType) return false;
    if (playerId == null) return false;
    const pendingPlayerId = (0, _playeridhelper.toPlayerId)(pending.playerId);
    return pendingPlayerId != null && pendingPlayerId === playerId;
}
function getPendingPawnOptions(pending) {
    const fromDataRaw = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
    const fromData = fromDataRaw.filter((option)=>Boolean(option) && typeof option === 'object');
    return fromData.map(normalizeOption).filter((x)=>x != null);
}
function listPendingPawnActions(pending, actionType) {
    return getPendingPawnOptions(pending).map((option)=>option.id).filter((id)=>id.length > 0).map((pawnId)=>({
            type: actionType,
            payload: {
                pawnId
            }
        }));
}
function resolvePendingPawnId(pending, payload, normalize = defaultNormalize) {
    const raw = toText(payload?.pawnId ?? payload?.pawn ?? payload?.value).trim();
    if (!raw) return null;
    const options = getPendingPawnOptions(pending);
    const normalizedRequested = normalize(raw);
    if (!normalizedRequested) return null;
    for (const option of options){
        const candidates = [
            option.id,
            option.label
        ];
        for (const candidate of candidates){
            const normalizedCandidate = normalize(candidate);
            if (normalizedCandidate && normalizedCandidate === normalizedRequested) {
                return option.id;
            }
        }
    }
    return null;
}
