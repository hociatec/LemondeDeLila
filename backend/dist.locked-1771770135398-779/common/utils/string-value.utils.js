"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringOrEmpty = stringOrEmpty;
function stringOrEmpty(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
//# sourceMappingURL=string-value.utils.js.map