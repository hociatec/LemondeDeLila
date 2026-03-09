"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "normalizeGameLogMessage", {
    enumerable: true,
    get: function() {
        return normalizeGameLogMessage;
    }
});
const _mojibake = require("../../../common/utils/mojibake");
function normalizeCommonFrenchTypos(input) {
    return input.replace(/\bdebut de partie\b/gi, (raw)=>raw[0] === raw[0].toUpperCase() ? 'Début de partie' : 'début de partie').replace(/\blance le de\b/gi, (raw)=>raw[0] === raw[0].toUpperCase() ? 'Lance le dé' : 'lance le dé').replace(/\blancez le de\b/gi, (raw)=>raw[0] === raw[0].toUpperCase() ? 'Lancez le dé' : 'lancez le dé');
}
function toLogString(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
function normalizeGameLogMessage(input) {
    const raw = toLogString(input);
    if (!raw) return '';
    const fixed = (0, _mojibake.fixMojibakeString)(raw);
    const normalized = fixed.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([,;:.!?])/g, '$1').replace(/(?<!\.)\.\.(?!\.)/g, '.').trim();
    return normalizeCommonFrenchTypos(normalized);
}
