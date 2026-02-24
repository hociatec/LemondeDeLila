"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pressed = pressed;
exports.interfaceShortcut = interfaceShortcut;
exports.actionShortcut = actionShortcut;
exports.when = when;
exports.concat = concat;
function pressed(key) {
    const trimmed = String(key ?? '').trim();
    return `pressed ${trimmed.toUpperCase()}`;
}
function interfaceShortcut(key, id) {
    return { key: pressed(key), type: 'interface', id };
}
function actionShortcut(key, actionType) {
    return { key: pressed(key), type: 'action', actionType };
}
function when(_ctx, condition, shortcuts) {
    if (!condition)
        return [];
    return [...shortcuts];
}
function concat(...parts) {
    return parts.flatMap((p) => [...p]);
}
//# sourceMappingURL=shortcut-utils.js.map