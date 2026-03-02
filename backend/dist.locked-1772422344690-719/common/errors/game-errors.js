/**
 * Context information for game errors
 */ "use strict";
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
    get GameContentError () {
        return GameContentError;
    },
    get GameError () {
        return GameError;
    },
    get GameStateError () {
        return GameStateError;
    },
    get GameValidationError () {
        return GameValidationError;
    },
    get PayloadValidationError () {
        return PayloadValidationError;
    },
    get PlayerActionError () {
        return PlayerActionError;
    }
});
let GameError = class GameError extends Error {
    /**
   * Returns a JSON representation of the error for logging
   */ toJSON() {
        return {
            name: this.name,
            message: this.message,
            severity: this.severity,
            context: this.context,
            stack: this.stack
        };
    }
    constructor(message, context, severity = 'medium'){
        super(message), this.context = context, this.severity = severity;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
};
let GameValidationError = class GameValidationError extends GameError {
    constructor(message, context = {}){
        super(message, {
            timestamp: new Date(),
            ...context
        }, 'high');
    }
};
let GameStateError = class GameStateError extends GameError {
    constructor(message, context = {}){
        super(message, {
            timestamp: new Date(),
            ...context
        }, 'critical');
    }
};
let PlayerActionError = class PlayerActionError extends GameError {
    constructor(message, context = {}){
        super(message, {
            timestamp: new Date(),
            ...context
        }, 'medium');
    }
};
let GameContentError = class GameContentError extends GameError {
    constructor(message, context = {}){
        super(message, {
            timestamp: new Date(),
            ...context
        }, 'critical');
    }
};
let PayloadValidationError = class PayloadValidationError extends GameValidationError {
    toJSON() {
        return {
            ...super.toJSON(),
            validationErrors: this.validationErrors
        };
    }
    constructor(message, validationErrors, context = {}){
        super(message, context), this.validationErrors = validationErrors;
    }
};
