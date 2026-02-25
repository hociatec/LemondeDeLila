"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildZigEtZagShortcuts", {
    enumerable: true,
    get: function() {
        return buildZigEtZagShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildZigEtZagShortcuts = ()=>[
        (0, _shortcututils.interfaceShortcut)('S', 'decks'),
        (0, _shortcututils.actionShortcut)('SPACE', 'draw_card')
    ];
