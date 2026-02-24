"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayloadValidationError = exports.GameContentError = exports.PlayerActionError = exports.GameStateError = exports.GameValidationError = exports.GameError = void 0;
class GameError extends Error {
    context;
    severity;
    constructor(message, context, severity = 'medium') {
        super(message);
        this.context = context;
        this.severity = severity;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            severity: this.severity,
            context: this.context,
            stack: this.stack,
        };
    }
}
exports.GameError = GameError;
class GameValidationError extends GameError {
    constructor(message, context = {}) {
        super(message, { timestamp: new Date(), ...context }, 'high');
    }
}
exports.GameValidationError = GameValidationError;
class GameStateError extends GameError {
    constructor(message, context = {}) {
        super(message, { timestamp: new Date(), ...context }, 'critical');
    }
}
exports.GameStateError = GameStateError;
class PlayerActionError extends GameError {
    constructor(message, context = {}) {
        super(message, { timestamp: new Date(), ...context }, 'medium');
    }
}
exports.PlayerActionError = PlayerActionError;
class GameContentError extends GameError {
    constructor(message, context = {}) {
        super(message, { timestamp: new Date(), ...context }, 'critical');
    }
}
exports.GameContentError = GameContentError;
class PayloadValidationError extends GameValidationError {
    validationErrors;
    constructor(message, validationErrors, context = {}) {
        super(message, context);
        this.validationErrors = validationErrors;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            validationErrors: this.validationErrors,
        };
    }
}
exports.PayloadValidationError = PayloadValidationError;
//# sourceMappingURL=game-errors.js.map