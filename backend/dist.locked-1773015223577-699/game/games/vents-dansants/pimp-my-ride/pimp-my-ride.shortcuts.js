"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildPimpMyRideShortcuts", {
    enumerable: true,
    get: function() {
        return buildPimpMyRideShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildPimpMyRideShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('C', 'play_card'),
        (0, _shortcututils.actionShortcut)('D', 'discard_card'),
        (0, _shortcututils.actionShortcut)('S', 'pass')
    ];
