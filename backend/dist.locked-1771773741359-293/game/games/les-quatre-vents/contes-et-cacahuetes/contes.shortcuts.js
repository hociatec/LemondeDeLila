"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContesShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildContesShortcuts = () => [
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'draw'),
    (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
    (0, shortcut_utils_1.interfaceShortcut)('P', 'position'),
];
exports.buildContesShortcuts = buildContesShortcuts;
//# sourceMappingURL=contes.shortcuts.js.map