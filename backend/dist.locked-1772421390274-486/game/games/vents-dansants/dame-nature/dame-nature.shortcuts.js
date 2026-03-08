"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildDameNatureShortcuts", {
    enumerable: true,
    get: function() {
        return buildDameNatureShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildDameNatureShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('A', 'ask_card'),
        (0, _shortcututils.actionShortcut)('S', 'pass')
    ];
