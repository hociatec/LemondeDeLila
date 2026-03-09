"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildMinuitShortcuts", {
    enumerable: true,
    get: function() {
        return buildMinuitShortcuts;
    }
});
const _shortcutpresets = require("../../../engine/shortcuts/shortcut-presets");
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildMinuitShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.actionShortcut)('SPACE', 'draw')
    ];
