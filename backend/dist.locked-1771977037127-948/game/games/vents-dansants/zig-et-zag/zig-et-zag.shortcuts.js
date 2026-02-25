"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildZigEtZagShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildZigEtZagShortcuts = () => [
    (0, shortcut_utils_1.interfaceShortcut)('S', 'decks'),
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'draw_card'),
];
exports.buildZigEtZagShortcuts = buildZigEtZagShortcuts;
//# sourceMappingURL=zig-et-zag.shortcuts.js.map