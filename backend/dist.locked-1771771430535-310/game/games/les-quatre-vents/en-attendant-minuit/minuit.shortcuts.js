"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMinuitShortcuts = void 0;
const shortcut_presets_1 = require("../../../engine/shortcuts/shortcut-presets");
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildMinuitShortcuts = () => [
    ...(0, shortcut_presets_1.positionOnlyShortcuts)(),
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'draw'),
];
exports.buildMinuitShortcuts = buildMinuitShortcuts;
//# sourceMappingURL=minuit.shortcuts.js.map