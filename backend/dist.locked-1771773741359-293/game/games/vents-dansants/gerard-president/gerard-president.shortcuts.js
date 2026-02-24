"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGerardPresidentShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildGerardPresidentShortcuts = () => [
    (0, shortcut_utils_1.actionShortcut)('T', 'set_theme'),
    (0, shortcut_utils_1.actionShortcut)('N', 'play_name'),
    (0, shortcut_utils_1.actionShortcut)('S', 'play_special'),
    (0, shortcut_utils_1.actionShortcut)('W', 'choose_winner'),
    (0, shortcut_utils_1.actionShortcut)('P', 'pass'),
];
exports.buildGerardPresidentShortcuts = buildGerardPresidentShortcuts;
//# sourceMappingURL=gerard-president.shortcuts.js.map