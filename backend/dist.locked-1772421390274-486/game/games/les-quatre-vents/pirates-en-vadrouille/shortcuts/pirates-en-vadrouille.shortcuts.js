"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildPiratesEnVadrouilleShortcuts", {
    enumerable: true,
    get: function() {
        return buildPiratesEnVadrouilleShortcuts;
    }
});
const _shortcutpresets = require("../../../../engine/shortcuts/shortcut-presets");
const _shortcututils = require("../../../../engine/shortcuts/shortcut-utils");
const buildPiratesEnVadrouilleShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.actionShortcut)('SPACE', 'draw'),
        (0, _shortcututils.interfaceShortcut)('S', 'score')
    ];
