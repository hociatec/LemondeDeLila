"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPimpMyRideShortcuts = void 0;
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const buildPimpMyRideShortcuts = () => [
    (0, shortcut_utils_1.actionShortcut)('C', 'play_card'),
    (0, shortcut_utils_1.actionShortcut)('D', 'discard_card'),
    (0, shortcut_utils_1.actionShortcut)('S', 'pass'),
];
exports.buildPimpMyRideShortcuts = buildPimpMyRideShortcuts;
//# sourceMappingURL=pimp-my-ride.shortcuts.js.map