"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "sanitizeText", {
    enumerable: true,
    get: function() {
        return sanitizeText;
    }
});
function sanitizeText(value) {
    if (typeof value !== 'string') return '';
    let out = '';
    for (const ch of value){
        const code = ch.charCodeAt(0);
        if (code >= 0x00 && code <= 0x1f || code === 0x7f) {
            continue;
        }
        out += ch;
    }
    return out.trim();
}
