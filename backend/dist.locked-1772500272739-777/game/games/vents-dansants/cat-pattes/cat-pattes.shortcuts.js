"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildCatPattesShortcuts", {
    enumerable: true,
    get: function() {
        return buildCatPattesShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildCatPattesShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('SPACE', 'draw'),
        (0, _shortcututils.interfaceShortcut)('S', 'score'),
        (0, _shortcututils.interfaceShortcut)('P', 'position'),
        (0, _shortcututils.interfaceShortcut)('I', 'info'),
        (0, _shortcututils.interfaceShortcut)('C', 'discard')
    ];
