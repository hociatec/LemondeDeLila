"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildNawakShortcuts", {
    enumerable: true,
    get: function() {
        return buildNawakShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildNawakShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('C', 'choose_answer'),
        (0, _shortcututils.actionShortcut)('V', 'vote_answer')
    ];
