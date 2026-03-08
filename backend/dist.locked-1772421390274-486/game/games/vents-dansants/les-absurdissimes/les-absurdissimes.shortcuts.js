"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildAbsurdissimesShortcuts", {
    enumerable: true,
    get: function() {
        return buildAbsurdissimesShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildAbsurdissimesShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('C', 'play_card'),
        (0, _shortcututils.actionShortcut)('J', 'judge_pick')
    ];
