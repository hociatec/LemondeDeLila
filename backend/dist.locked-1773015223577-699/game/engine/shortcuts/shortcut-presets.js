"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get positionOnlyShortcuts () {
        return positionOnlyShortcuts;
    },
    get stableAndPositionShortcuts () {
        return stableAndPositionShortcuts;
    }
});
const _shortcututils = require("./shortcut-utils");
function positionOnlyShortcuts() {
    return [
        (0, _shortcututils.interfaceShortcut)('P', 'position')
    ];
}
function stableAndPositionShortcuts() {
    return [
        (0, _shortcututils.interfaceShortcut)('S', 'stable'),
        (0, _shortcututils.interfaceShortcut)('P', 'position')
    ];
}
