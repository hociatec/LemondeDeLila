"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildOlympiaShortcuts", {
    enumerable: true,
    get: function() {
        return buildOlympiaShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildOlympiaShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('D', 'draw_card'),
        (0, _shortcututils.actionShortcut)('C', 'play_card'),
        (0, _shortcututils.actionShortcut)('S', 'pass')
    ];
