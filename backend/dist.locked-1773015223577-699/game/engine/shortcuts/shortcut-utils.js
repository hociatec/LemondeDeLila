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
    get actionShortcut () {
        return actionShortcut;
    },
    get concat () {
        return concat;
    },
    get interfaceShortcut () {
        return interfaceShortcut;
    },
    get pressed () {
        return pressed;
    },
    get when () {
        return when;
    }
});
function pressed(key) {
    const trimmed = String(key ?? '').trim();
    return `pressed ${trimmed.toUpperCase()}`;
}
function interfaceShortcut(key, id) {
    return {
        key: pressed(key),
        type: 'interface',
        id
    };
}
function actionShortcut(key, actionType) {
    return {
        key: pressed(key),
        type: 'action',
        actionType
    };
}
function when(_ctx, condition, shortcuts) {
    if (!condition) return [];
    return [
        ...shortcuts
    ];
}
function concat(...parts) {
    return parts.flatMap((p)=>[
            ...p
        ]);
}
