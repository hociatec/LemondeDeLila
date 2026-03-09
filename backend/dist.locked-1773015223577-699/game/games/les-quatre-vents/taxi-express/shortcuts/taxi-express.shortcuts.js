"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildTaxiExpressShortcuts", {
    enumerable: true,
    get: function() {
        return buildTaxiExpressShortcuts;
    }
});
const _shortcututils = require("../../../../engine/shortcuts/shortcut-utils");
const buildTaxiExpressShortcuts = ()=>[
        (0, _shortcututils.interfaceShortcut)('P', 'position'),
        (0, _shortcututils.actionShortcut)('SPACE', 'roll'),
        (0, _shortcututils.interfaceShortcut)('S', 'score')
    ];
