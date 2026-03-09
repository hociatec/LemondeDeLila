"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildLaParadeSucreeShortcuts", {
    enumerable: true,
    get: function() {
        return buildLaParadeSucreeShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildLaParadeSucreeShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('C', 'play_card'),
        (0, _shortcututils.actionShortcut)('S', 'pass')
    ];
