"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFrousseShortcuts = void 0;
const shortcut_presets_1 = require("../../../engine/shortcuts/shortcut-presets");
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildFrousseShortcuts = () => [
    ...(0, shortcut_presets_1.positionOnlyShortcuts)(),
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'draw'),
];
exports.buildFrousseShortcuts = buildFrousseShortcuts;
//# sourceMappingURL=frousse.shortcuts.js.map