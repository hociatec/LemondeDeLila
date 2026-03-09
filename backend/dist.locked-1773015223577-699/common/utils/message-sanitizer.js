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
    get DEFAULT_MESSAGE_MAX_LENGTH () {
        return DEFAULT_MESSAGE_MAX_LENGTH;
    },
    get sanitizeMessage () {
        return sanitizeMessage;
    }
});
const DEFAULT_MESSAGE_MAX_LENGTH = 1000;
function sanitizeMessage(raw, options = {}) {
    const { encodeHtml = false, collapseNewLines = true, stripHtml = true } = options;
    let sanitized = (raw ?? '').trim();
    if (stripHtml) {
        sanitized = sanitized.replace(/<[^>]*>?/gm, '');
    }
    if (collapseNewLines) {
        sanitized = sanitized.replace(/[\r\n]+/g, ' ');
    }
    sanitized = sanitized.trim();
    if (!encodeHtml) {
        return sanitized;
    }
    return sanitized.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
