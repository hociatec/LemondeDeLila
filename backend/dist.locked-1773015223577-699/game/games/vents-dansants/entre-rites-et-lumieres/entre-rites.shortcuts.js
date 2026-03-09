"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildEntreRitesShortcuts", {
    enumerable: true,
    get: function() {
        return buildEntreRitesShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildEntreRitesShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('A', 'ask_card'),
        (0, _shortcututils.actionShortcut)('S', 'pass')
    ];
