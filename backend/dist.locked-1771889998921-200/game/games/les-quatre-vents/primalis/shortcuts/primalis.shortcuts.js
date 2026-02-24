"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrimalisShortcuts = void 0;
const shortcut_presets_1 = require("../../../../engine/shortcuts/shortcut-presets");
const shortcut_utils_1 = require("../../../../engine/shortcuts/shortcut-utils");
const buildPrimalisShortcuts = () => [
    ...(0, shortcut_presets_1.positionOnlyShortcuts)(),
    (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
    (0, shortcut_utils_1.interfaceShortcut)('V', 'ressources'),
];
exports.buildPrimalisShortcuts = buildPrimalisShortcuts;
//# sourceMappingURL=primalis.shortcuts.js.map