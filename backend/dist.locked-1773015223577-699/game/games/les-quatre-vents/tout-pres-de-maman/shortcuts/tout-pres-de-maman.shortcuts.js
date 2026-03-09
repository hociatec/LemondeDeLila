"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildToutPresDeMamanShortcuts", {
    enumerable: true,
    get: function() {
        return buildToutPresDeMamanShortcuts;
    }
});
const _shortcututils = require("../../../../engine/shortcuts/shortcut-utils");
const buildToutPresDeMamanShortcuts = ()=>[
        (0, _shortcututils.interfaceShortcut)('P', 'position'),
        (0, _shortcututils.actionShortcut)('SPACE', 'roll'),
        (0, _shortcututils.interfaceShortcut)('S', 'score')
    ];
