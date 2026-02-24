"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDameNatureShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildDameNatureShortcuts = () => [
    (0, shortcut_utils_1.actionShortcut)('A', 'ask_card'),
    (0, shortcut_utils_1.actionShortcut)('S', 'pass'),
];
exports.buildDameNatureShortcuts = buildDameNatureShortcuts;
//# sourceMappingURL=dame-nature.shortcuts.js.map