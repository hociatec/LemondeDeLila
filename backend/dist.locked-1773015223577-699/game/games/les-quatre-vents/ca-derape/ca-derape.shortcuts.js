"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildCaDerapeShortcuts", {
    enumerable: true,
    get: function() {
        return buildCaDerapeShortcuts;
    }
});
const _shortcutpresets = require("../../../engine/shortcuts/shortcut-presets");
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildCaDerapeShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.actionShortcut)('SPACE', 'draw')
    ];
