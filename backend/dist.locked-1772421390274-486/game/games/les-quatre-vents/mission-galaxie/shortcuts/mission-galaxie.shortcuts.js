"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildMissionGalaxieShortcuts", {
    enumerable: true,
    get: function() {
        return buildMissionGalaxieShortcuts;
    }
});
const _shortcutpresets = require("../../../../engine/shortcuts/shortcut-presets");
const _shortcututils = require("../../../../engine/shortcuts/shortcut-utils");
const buildMissionGalaxieShortcuts = ()=>[
        ...(0, _shortcutpresets.positionOnlyShortcuts)(),
        (0, _shortcututils.actionShortcut)('SPACE', 'draw')
    ];
