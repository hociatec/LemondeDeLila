"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildAventureSauvageShortcuts", {
    enumerable: true,
    get: function() {
        return buildAventureSauvageShortcuts;
    }
});
const _shortcutpresets = require("../../../engine/shortcuts/shortcut-presets");
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildAventureSauvageShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.actionShortcut)('SPACE', 'draw')
    ];
