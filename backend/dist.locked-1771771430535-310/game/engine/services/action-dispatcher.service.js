"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const game_errors_1 = require("../../../common/errors/game-errors");
let ActionDispatcherService = class ActionDispatcherService {
    handlers = new Map();
    register(handler) {
        const actionType = handler.actionType.toLowerCase();
        if (this.handlers.has(actionType)) {
            throw new Error(`Action handler already registered for action type: ${actionType}`);
        }
        this.handlers.set(actionType, handler);
    }
    registerMany(handlers) {
        handlers.forEach((handler) => this.register(handler));
    }
    dispatch(state, action, actorId) {
        const actionType = String(action?.type ?? '').toLowerCase();
        const handler = this.handlers.get(actionType);
        if (!handler) {
            throw new game_errors_1.GameValidationError(`No handler registered for action type: ${actionType}`, {
                gameType: getGameType(state),
                action: actionType,
                registeredActions: Array.from(this.handlers.keys()),
            });
        }
        return handler.handle(state, action, actorId);
    }
    hasHandler(actionType) {
        return this.handlers.has(actionType.toLowerCase());
    }
    getRegisteredActions() {
        return Array.from(this.handlers.keys());
    }
    clear() {
        this.handlers.clear();
    }
};
exports.ActionDispatcherService = ActionDispatcherService;
exports.ActionDispatcherService = ActionDispatcherService = __decorate([
    (0, common_1.Injectable)()
], ActionDispatcherService);
function getMetadata(state) {
    const metadata = state.metadata;
    return (metadata && typeof metadata === 'object' ? metadata : {});
}
function getGameType(state) {
    const metadata = getMetadata(state);
    const gameType = metadata.gameType;
    return typeof gameType === 'string' ? gameType : undefined;
}
//# sourceMappingURL=action-dispatcher.service.js.map