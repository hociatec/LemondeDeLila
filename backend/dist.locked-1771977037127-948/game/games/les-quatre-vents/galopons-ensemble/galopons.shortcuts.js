"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGaloponsShortcuts = void 0;
const shortcut_presets_1 = require("../../../engine/shortcuts/shortcut-presets");
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildGaloponsShortcuts = () => [
    ...(0, shortcut_presets_1.positionOnlyShortcuts)(),
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'draw'),
    (0, shortcut_utils_1.interfaceShortcut)('S', 'apples'),
];
exports.buildGaloponsShortcuts = buildGaloponsShortcuts;
//# sourceMappingURL=galopons.shortcuts.js.map