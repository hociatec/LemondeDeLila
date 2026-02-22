"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildToutPresDeMamanShortcuts = void 0;
const shortcut_utils_1 = require("../../../../engine/shortcuts/shortcut-utils");
const buildToutPresDeMamanShortcuts = () => [
    (0, shortcut_utils_1.interfaceShortcut)('P', 'position'),
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'roll'),
    (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
];
exports.buildToutPresDeMamanShortcuts = buildToutPresDeMamanShortcuts;
//# sourceMappingURL=tout-pres-de-maman.shortcuts.js.map