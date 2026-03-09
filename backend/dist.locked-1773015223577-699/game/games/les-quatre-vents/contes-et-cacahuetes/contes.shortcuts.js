"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildContesShortcuts", {
    enumerable: true,
    get: function() {
        return buildContesShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildContesShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('SPACE', 'draw'),
        (0, _shortcututils.interfaceShortcut)('S', 'score'),
        (0, _shortcututils.interfaceShortcut)('P', 'position')
    ];
