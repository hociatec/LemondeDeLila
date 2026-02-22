"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNawakShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildNawakShortcuts = () => [
    (0, shortcut_utils_1.actionShortcut)('C', 'choose_answer'),
    (0, shortcut_utils_1.actionShortcut)('V', 'vote_answer'),
];
exports.buildNawakShortcuts = buildNawakShortcuts;
//# sourceMappingURL=nawak.shortcuts.js.map