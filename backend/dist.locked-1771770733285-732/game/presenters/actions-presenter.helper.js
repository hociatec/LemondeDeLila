"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPresenterActions = formatPresenterActions;
function formatPresenterActions(actions, labelResolver) {
    return (actions ?? []).map((action) => ({
        type: action.type,
        label: labelResolver ? labelResolver(action) : action.type,
        payload: action.payload && typeof action.payload === 'object'
            ? action.payload
            : {},
    }));
}
//# sourceMappingURL=actions-presenter.helper.js.map