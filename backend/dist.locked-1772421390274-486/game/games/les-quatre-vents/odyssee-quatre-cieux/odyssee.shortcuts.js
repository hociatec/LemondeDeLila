"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildOdysseeShortcuts", {
    enumerable: true,
    get: function() {
        return buildOdysseeShortcuts;
    }
});
const _shortcutpresets = require("../../../engine/shortcuts/shortcut-presets");
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildOdysseeShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.interfaceShortcut)('E', 'stable'),
        (0, _shortcututils.interfaceShortcut)('S', 'score')
    ];
