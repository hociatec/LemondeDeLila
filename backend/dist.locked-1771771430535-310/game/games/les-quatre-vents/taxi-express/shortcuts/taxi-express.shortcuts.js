"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTaxiExpressShortcuts = void 0;
const shortcut_utils_1 = require("../../../../engine/shortcuts/shortcut-utils");
const buildTaxiExpressShortcuts = () => [
    (0, shortcut_utils_1.interfaceShortcut)('P', 'position'),
    (0, shortcut_utils_1.actionShortcut)('SPACE', 'roll'),
    (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
];
exports.buildTaxiExpressShortcuts = buildTaxiExpressShortcuts;
//# sourceMappingURL=taxi-express.shortcuts.js.map