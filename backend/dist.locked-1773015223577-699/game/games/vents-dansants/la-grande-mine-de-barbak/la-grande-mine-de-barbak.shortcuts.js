"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildLaGrandeMineDeBarbakShortcuts", {
    enumerable: true,
    get: function() {
        return buildLaGrandeMineDeBarbakShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildLaGrandeMineDeBarbakShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('C', 'play_card'),
        (0, _shortcututils.actionShortcut)('S', 'pass')
    ];
