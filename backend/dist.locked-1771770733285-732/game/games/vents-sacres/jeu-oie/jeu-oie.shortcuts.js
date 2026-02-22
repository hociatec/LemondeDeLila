"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildJeuOieShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const shortcut_presets_1 = require("../../../engine/shortcuts/shortcut-presets");
const buildJeuOieShortcuts = () => [
    ...(0, shortcut_presets_1.positionOnlyShortcuts)(),
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'roll'),
];
exports.buildJeuOieShortcuts = buildJeuOieShortcuts;
//# sourceMappingURL=jeu-oie.shortcuts.js.map