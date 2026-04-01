"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildGerardPresidentShortcuts", {
    enumerable: true,
    get: function() {
        return buildGerardPresidentShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildGerardPresidentShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('T', 'set_theme'),
        (0, _shortcututils.actionShortcut)('N', 'play_name'),
        (0, _shortcututils.actionShortcut)('S', 'play_special'),
        (0, _shortcututils.actionShortcut)('W', 'choose_winner'),
        (0, _shortcututils.actionShortcut)('P', 'pass')
    ];
