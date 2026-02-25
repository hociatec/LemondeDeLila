"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOdysseeShortcuts = void 0;
const shortcut_presets_1 = require("../../../engine/shortcuts/shortcut-presets");
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildOdysseeShortcuts = () => [
    ...(0, shortcut_presets_1.positionOnlyShortcuts)(),
    (0, shortcut_utils_1.interfaceShortcut)('E', 'stable'),
    (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
];
exports.buildOdysseeShortcuts = buildOdysseeShortcuts;
//# sourceMappingURL=odyssee.shortcuts.js.map