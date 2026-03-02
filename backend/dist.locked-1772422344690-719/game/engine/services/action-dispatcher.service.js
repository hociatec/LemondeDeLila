"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ActionDispatcherService", {
    enumerable: true,
    get: function() {
        return ActionDispatcherService;
    }
});
const _common = require("@nestjs/common");
const _gameerrors = require("../../../common/errors/game-errors");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let ActionDispatcherService = class ActionDispatcherService {
    /**
   * Enregistre un handler pour un type d'action.
   *
   * @param handler - Handler à enregistrer
   * @throws {Error} Si un handler est déjà enregistré pour ce type
   */ register(handler) {
        const actionType = handler.actionType.toLowerCase();
        if (this.handlers.has(actionType)) {
            throw new Error(`Action handler already registered for action type: ${actionType}`);
        }
        this.handlers.set(actionType, handler);
    }
    /**
   * Enregistre plusieurs handlers d'un coup.
   *
   * @param handlers - Handlers à enregistrer
   */ registerMany(handlers) {
        handlers.forEach((handler)=>this.register(handler));
    }
    /**
   * Dispatch une action vers le handler approprié.
   *
   * @param state - État actuel du jeu
   * @param action - Action à dispatcher
   * @param actorId - ID de l'acteur effectuant l'action
   * @returns Nouvel état après traitement
   *
   * @throws {GameValidationError} Si aucun handler n'est enregistré pour ce type
   */ dispatch(state, action, actorId) {
        const actionType = String(action?.type ?? '').toLowerCase();
        const handler = this.handlers.get(actionType);
        if (!handler) {
            throw new _gameerrors.GameValidationError(`No handler registered for action type: ${actionType}`, {
                gameType: getGameType(state),
                action: actionType,
                registeredActions: Array.from(this.handlers.keys())
            });
        }
        return handler.handle(state, action, actorId);
    }
    /**
   * Vérifie si un handler est enregistré pour un type d'action.
   *
   * @param actionType - Type d'action à vérifier
   * @returns true si un handler est enregistré
   */ hasHandler(actionType) {
        return this.handlers.has(actionType.toLowerCase());
    }
    /**
   * Récupère la liste des types d'actions enregistrés.
   *
   * @returns Liste des types d'actions
   */ getRegisteredActions() {
        return Array.from(this.handlers.keys());
    }
    /**
   * Supprime tous les handlers enregistrés.
   *
   * Utile pour les tests ou la réinitialisation.
   */ clear() {
        this.handlers.clear();
    }
    constructor(){
        this.handlers = new Map();
    }
};
ActionDispatcherService = _ts_decorate([
    (0, _common.Injectable)()
], ActionDispatcherService);
function getMetadata(state) {
    const metadata = state.metadata;
    return metadata && typeof metadata === 'object' ? metadata : {};
}
function getGameType(state) {
    const metadata = getMetadata(state);
    const gameType = metadata.gameType;
    return typeof gameType === 'string' ? gameType : undefined;
}
