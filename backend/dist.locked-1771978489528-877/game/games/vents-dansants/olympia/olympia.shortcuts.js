"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOlympiaShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildOlympiaShortcuts = () => [
    (0, shortcut_utils_1.actionShortcut)('D', 'draw_card'),
    (0, shortcut_utils_1.actionShortcut)('C', 'play_card'),
    (0, shortcut_utils_1.actionShortcut)('S', 'pass'),
];
exports.buildOlympiaShortcuts = buildOlympiaShortcuts;
//# sourceMappingURL=olympia.shortcuts.js.map