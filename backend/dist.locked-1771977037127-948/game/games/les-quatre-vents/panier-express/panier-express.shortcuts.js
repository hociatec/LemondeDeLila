"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPanierExpressShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildPanierExpressShortcuts = () => {
    return [
        (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
        (0, shortcut_utils_1.interfaceShortcut)('L', 'shopping'),
        (0, shortcut_utils_1.interfaceShortcut)('SHIFT+L', 'shopping_all'),
        (0, shortcut_utils_1.interfaceShortcut)('B', 'basket'),
        (0, shortcut_utils_1.interfaceShortcut)('I', 'inventory'),
        (0, shortcut_utils_1.interfaceShortcut)('SHIFT+I', 'inventory_all'),
        (0, shortcut_utils_1.interfaceShortcut)('P', 'position'),
    ];
};
exports.buildPanierExpressShortcuts = buildPanierExpressShortcuts;
//# sourceMappingURL=panier-express.shortcuts.js.map