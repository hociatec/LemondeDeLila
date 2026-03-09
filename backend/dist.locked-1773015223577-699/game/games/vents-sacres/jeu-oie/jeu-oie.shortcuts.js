"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildJeuOieShortcuts", {
    enumerable: true,
    get: function() {
        return buildJeuOieShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const _shortcutpresets = require("../../../engine/shortcuts/shortcut-presets");
const buildJeuOieShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.actionShortcut)('SPACE', 'roll')
    ];
