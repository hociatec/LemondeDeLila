"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMonVillageShortcuts = void 0;
const shortcut_presets_1 = require("../../../../engine/shortcuts/shortcut-presets");
const shortcut_utils_1 = require("../../../../engine/shortcuts/shortcut-utils");
const buildMonVillageShortcuts = () => [
    ...(0, shortcut_presets_1.positionOnlyShortcuts)(),
    (0, shortcut_utils_1.interfaceShortcut)('I', 'cartes'),
    (0, shortcut_utils_1.interfaceShortcut)('V', 'available'),
    (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
];
exports.buildMonVillageShortcuts = buildMonVillageShortcuts;
//# sourceMappingURL=mon-village.shortcuts.js.map