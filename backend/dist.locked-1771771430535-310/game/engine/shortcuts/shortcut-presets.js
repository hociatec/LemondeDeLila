"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.positionOnlyShortcuts = positionOnlyShortcuts;
exports.stableAndPositionShortcuts = stableAndPositionShortcuts;
const shortcut_utils_1 = require("./shortcut-utils");
function positionOnlyShortcuts() {
    return [(0, shortcut_utils_1.interfaceShortcut)('P', 'position')];
}
function stableAndPositionShortcuts() {
    return [(0, shortcut_utils_1.interfaceShortcut)('S', 'stable'), (0, shortcut_utils_1.interfaceShortcut)('P', 'position')];
}
//# sourceMappingURL=shortcut-presets.js.map