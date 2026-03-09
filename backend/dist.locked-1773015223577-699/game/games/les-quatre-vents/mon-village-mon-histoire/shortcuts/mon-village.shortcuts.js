"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildMonVillageShortcuts", {
    enumerable: true,
    get: function() {
        return buildMonVillageShortcuts;
    }
});
const _shortcutpresets = require("../../../../engine/shortcuts/shortcut-presets");
const _shortcututils = require("../../../../engine/shortcuts/shortcut-utils");
const buildMonVillageShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.interfaceShortcut)('I', 'cartes'),
        (0, _shortcututils.interfaceShortcut)('V', 'available'),
        (0, _shortcututils.interfaceShortcut)('S', 'score')
    ];
