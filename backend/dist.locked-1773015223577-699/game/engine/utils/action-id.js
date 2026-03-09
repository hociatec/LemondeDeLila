"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "computeActionId", {
    enumerable: true,
    get: function() {
        return computeActionId;
    }
});
const _crypto = require("crypto");
function stableStringify(value) {
    if (value === null || value === undefined) return 'null';
    const t = typeof value;
    if (t === 'string') return JSON.stringify(value);
    if (t === 'number') {
        const numeric = value;
        return Number.isFinite(numeric) ? String(numeric) : 'null';
    }
    if (t === 'boolean') {
        const booleanValue = value;
        return booleanValue ? 'true' : 'false';
    }
    if (Array.isArray(value)) {
        const contents = value.map((v)=>stableStringify(v)).join(',');
        return `[${contents}]`;
    }
    if (t === 'object') {
        const obj = value;
        const keys = Object.keys(obj).sort();
        return `{${keys.map((k)=>`${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
    }
    return 'null';
}
function computeActionId(type, payload) {
    const t = String(type ?? '').trim().toLowerCase();
    const canonicalPayload = stableStringify(payload ?? null);
    const hex = (0, _crypto.createHash)('sha256').update(`${t}|${canonicalPayload}`, 'utf8').digest('hex').slice(0, 16);
    return `act_${hex}`;
}
