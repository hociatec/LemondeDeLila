"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildPanierExpressShortcuts", {
    enumerable: true,
    get: function() {
        return buildPanierExpressShortcuts;
    }
});
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const buildPanierExpressShortcuts = ()=>{
    return [
        (0, _shortcututils.interfaceShortcut)('S', 'score'),
        (0, _shortcututils.interfaceShortcut)('L', 'shopping'),
        (0, _shortcututils.interfaceShortcut)('SHIFT+L', 'shopping_all'),
        (0, _shortcututils.interfaceShortcut)('B', 'basket'),
        (0, _shortcututils.interfaceShortcut)('I', 'inventory'),
        (0, _shortcututils.interfaceShortcut)('SHIFT+I', 'inventory_all'),
        (0, _shortcututils.interfaceShortcut)('P', 'position')
    ];
};
