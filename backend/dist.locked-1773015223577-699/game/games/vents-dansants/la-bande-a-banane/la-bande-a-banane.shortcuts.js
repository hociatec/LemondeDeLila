"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildLaBandeABananeShortcuts", {
    enumerable: true,
    get: function() {
        return buildLaBandeABananeShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildLaBandeABananeShortcuts = ()=>[
        (0, _shortcututils.actionShortcut)('C', 'play_card'),
        (0, _shortcututils.actionShortcut)('S', 'pass')
    ];
