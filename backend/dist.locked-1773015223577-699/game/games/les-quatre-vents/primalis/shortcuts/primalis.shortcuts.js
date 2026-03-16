"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildPrimalisShortcuts", {
    enumerable: true,
    get: function() {
        return buildPrimalisShortcuts;
    }
});
const _shortcutpresets = require("../../../../engine/shortcuts/shortcut-presets");
const _shortcututils = require("../../../../engine/shortcuts/shortcut-utils");
const buildPrimalisShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.interfaceShortcut)('S', 'score'),
        (0, _shortcututils.interfaceShortcut)('V', 'ressources')
    ];
