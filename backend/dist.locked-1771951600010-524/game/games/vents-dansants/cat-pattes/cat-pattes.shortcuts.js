"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCatPattesShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildCatPattesShortcuts = () => [
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'draw'),
    (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
    (0, shortcut_utils_1.interfaceShortcut)('P', 'position'),
];
exports.buildCatPattesShortcuts = buildCatPattesShortcuts;
//# sourceMappingURL=cat-pattes.shortcuts.js.map