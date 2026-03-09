"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildFrousseShortcuts", {
    enumerable: true,
    get: function() {
        return buildFrousseShortcuts;
    }
});
const _shortcutpresets = require("../../../engine/shortcuts/shortcut-presets");
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildFrousseShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.actionShortcut)('SPACE', 'draw')
    ];
