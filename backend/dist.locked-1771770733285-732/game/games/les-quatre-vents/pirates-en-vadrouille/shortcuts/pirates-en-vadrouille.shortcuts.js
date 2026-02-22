"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPiratesEnVadrouilleShortcuts = void 0;
const shortcut_presets_1 = require("../../../../engine/shortcuts/shortcut-presets");
const shortcut_utils_1 = require("../../../../engine/shortcuts/shortcut-utils");
const buildPiratesEnVadrouilleShortcuts = () => [
    ...(0, shortcut_presets_1.positionOnlyShortcuts)(),
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'draw'),
    (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
];
exports.buildPiratesEnVadrouilleShortcuts = buildPiratesEnVadrouilleShortcuts;
//# sourceMappingURL=pirates-en-vadrouille.shortcuts.js.map