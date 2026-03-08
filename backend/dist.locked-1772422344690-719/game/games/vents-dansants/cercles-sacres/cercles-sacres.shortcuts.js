"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildCerclesSacresShortcuts", {
    enumerable: true,
    get: function() {
        return buildCerclesSacresShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildCerclesSacresShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('F', 'form_circle'),
        (0, _shortcututils.actionShortcut)('D', 'discard_card'),
        (0, _shortcututils.actionShortcut)('S', 'pass')
    ];
