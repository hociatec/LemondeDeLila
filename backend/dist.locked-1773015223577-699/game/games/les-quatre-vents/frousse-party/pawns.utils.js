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
    get formatPawnChoiceLabel () {
        return formatPawnChoiceLabel;
    },
    get resolvePawnId () {
        return resolvePawnId;
    }
});
function resolvePawnId(raw) {
    if (raw == null) return null;
    const value = toText(raw);
    return value.length > 0 ? value : null;
}
function formatPawnChoiceLabel(pawn) {
    const name = String(pawn?.name ?? '').trim();
    const description = String(pawn?.description ?? '').trim();
    if (name && description) {
        return `${name}: ${description}`;
    }
    if (name) {
        return name;
    }
    if (description) {
        return description;
    }
    return String(pawn?.id ?? 'Pion');
}
function toText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return '';
}
