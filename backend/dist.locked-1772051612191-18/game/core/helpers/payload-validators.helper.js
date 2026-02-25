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
    get optionalInt () {
        return optionalInt;
    },
    get optionalString () {
        return optionalString;
    },
    get requiredArrayIndex () {
        return requiredArrayIndex;
    },
    get requiredEnumValue () {
        return requiredEnumValue;
    },
    get requiredInt () {
        return requiredInt;
    },
    get requiredString () {
        return requiredString;
    }
});
function asPayloadRecord(payload) {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload;
    }
    return {};
}
function toPayloadText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
function requiredInt(payload, key, message) {
    const value = Number(asPayloadRecord(payload)[key]);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error(message ?? `${key} est requis.`);
    }
    return value;
}
function optionalInt(payload, key) {
    const raw = asPayloadRecord(payload)[key];
    if (raw == null || raw === '') return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error(`${key} est invalide.`);
    }
    return value;
}
function requiredString(payload, key, message) {
    const value = toPayloadText(asPayloadRecord(payload)[key]).trim();
    if (!value) {
        throw new Error(message ?? `${key} est requis.`);
    }
    return value;
}
function optionalString(payload, key) {
    const raw = asPayloadRecord(payload)[key];
    if (raw == null) return undefined;
    const value = toPayloadText(raw).trim();
    return value || undefined;
}
function requiredEnumValue(payload, key, allowed, message) {
    const value = requiredString(payload, key, message);
    if (!allowed.includes(value)) {
        throw new Error(message ?? `${key} est invalide.`);
    }
    return value;
}
function requiredArrayIndex(payload, key, length, message) {
    const index = requiredInt(payload, key, message);
    if (index < 0 || index >= Math.max(0, Math.trunc(length))) {
        throw new Error(message ?? `${key} est hors limites.`);
    }
    return index;
}
