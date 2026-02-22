"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCerclesSacresShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildCerclesSacresShortcuts = () => [
    (0, shortcut_utils_1.actionShortcut)('F', 'form_circle'),
    (0, shortcut_utils_1.actionShortcut)('D', 'discard_card'),
    (0, shortcut_utils_1.actionShortcut)('S', 'pass'),
];
exports.buildCerclesSacresShortcuts = buildCerclesSacresShortcuts;
//# sourceMappingURL=cercles-sacres.shortcuts.js.map