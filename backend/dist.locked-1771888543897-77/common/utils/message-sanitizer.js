"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MESSAGE_MAX_LENGTH = void 0;
exports.sanitizeMessage = sanitizeMessage;
exports.DEFAULT_MESSAGE_MAX_LENGTH = 1000;
function sanitizeMessage(raw, options = {}) {
    const { encodeHtml = false, collapseNewLines = true, stripHtml = true, } = options;
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
    return sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
//# sourceMappingURL=message-sanitizer.js.map