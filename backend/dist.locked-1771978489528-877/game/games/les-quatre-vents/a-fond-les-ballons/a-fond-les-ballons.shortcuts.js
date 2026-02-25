"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAFondLesBallonsShortcuts = void 0;
const shortcut_presets_1 = require("../../../engine/shortcuts/shortcut-presets");
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildAFondLesBallonsShortcuts = () => [
    ...(0, shortcut_presets_1.positionOnlyShortcuts)(),
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'draw'),
];
exports.buildAFondLesBallonsShortcuts = buildAFondLesBallonsShortcuts;
//# sourceMappingURL=a-fond-les-ballons.shortcuts.js.map