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
    get ArrayItemsValidator () {
        return ArrayItemsValidator;
    },
    get CompositeValidator () {
        return CompositeValidator;
    },
    get HasArrayValidator () {
        return HasArrayValidator;
    },
    get HasFieldValidator () {
        return HasFieldValidator;
    },
    get HasVersionValidator () {
        return HasVersionValidator;
    },
    get NotEmptyValidator () {
        return NotEmptyValidator;
    },
    get createGameContentValidators () {
        return createGameContentValidators;
    }
});
const _gameerrors = require("../errors/game-errors");
let HasVersionValidator = class HasVersionValidator {
    validate(content, filePath) {
        if (!content || typeof content !== 'object') {
            throw new _gameerrors.GameContentError(`Content must be an object${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                timestamp: new Date()
            });
        }
        const version = content.version;
        if (typeof version !== 'number') {
            throw new _gameerrors.GameContentError(`Missing or invalid version field${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                expectedVersion: this.expectedVersion,
                timestamp: new Date()
            });
        }
        if (version !== this.expectedVersion) {
            throw new _gameerrors.GameContentError(`Version mismatch: expected ${this.expectedVersion}, got ${version}${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                expectedVersion: this.expectedVersion,
                actualVersion: version,
                timestamp: new Date()
            });
        }
    }
    constructor(expectedVersion){
        this.expectedVersion = expectedVersion;
    }
};
let HasArrayValidator = class HasArrayValidator {
    validate(content, filePath) {
        if (!content || typeof content !== 'object') {
            throw new _gameerrors.GameContentError(`Content must be an object${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                timestamp: new Date()
            });
        }
        const field = content[this.fieldName];
        if (!Array.isArray(field)) {
            throw new _gameerrors.GameContentError(`Field "${this.fieldName}" must be an array${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                fieldName: this.fieldName,
                timestamp: new Date()
            });
        }
        if (field.length < this.minLength) {
            throw new _gameerrors.GameContentError(`Field "${this.fieldName}" must contain at least ${this.minLength} element(s), got ${field.length}${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                fieldName: this.fieldName,
                minLength: this.minLength,
                actualLength: field.length,
                timestamp: new Date()
            });
        }
    }
    constructor(fieldName, minLength = 1){
        this.fieldName = fieldName;
        this.minLength = minLength;
    }
};
let HasFieldValidator = class HasFieldValidator {
    validate(content, filePath) {
        if (!content || typeof content !== 'object') {
            throw new _gameerrors.GameContentError(`Content must be an object${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                timestamp: new Date()
            });
        }
        const field = content[this.fieldName];
        if (field === undefined || field === null) {
            throw new _gameerrors.GameContentError(`Missing required field "${this.fieldName}"${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                fieldName: this.fieldName,
                timestamp: new Date()
            });
        }
        if (this.fieldType) {
            const actualType = Array.isArray(field) ? 'array' : typeof field;
            if (actualType !== this.fieldType) {
                throw new _gameerrors.GameContentError(`Field "${this.fieldName}" must be of type ${this.fieldType}, got ${actualType}${filePath ? ` in ${filePath}` : ''}`, {
                    filePath,
                    fieldName: this.fieldName,
                    expectedType: this.fieldType,
                    actualType,
                    timestamp: new Date()
                });
            }
        }
    }
    constructor(fieldName, fieldType){
        this.fieldName = fieldName;
        this.fieldType = fieldType;
    }
};
let ArrayItemsValidator = class ArrayItemsValidator {
    validate(content, filePath) {
        if (!content || typeof content !== 'object') {
            throw new _gameerrors.GameContentError(`Content must be an object${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                timestamp: new Date()
            });
        }
        const rawArray = content[this.arrayFieldName];
        if (!Array.isArray(rawArray)) {
            throw new _gameerrors.GameContentError(`Field "${this.arrayFieldName}" must be an array${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                fieldName: this.arrayFieldName,
                timestamp: new Date()
            });
        }
        const array = rawArray;
        for(let i = 0; i < array.length; i++){
            const item = array[i];
            if (!item || typeof item !== 'object') {
                throw new _gameerrors.GameContentError(`Item at index ${i} in "${this.arrayFieldName}" must be an object${filePath ? ` in ${filePath}` : ''}`, {
                    filePath,
                    arrayFieldName: this.arrayFieldName,
                    itemIndex: i,
                    timestamp: new Date()
                });
            }
            for (const field of this.requiredFields){
                if (!Object.prototype.hasOwnProperty.call(item, field)) {
                    throw new _gameerrors.GameContentError(`Item at index ${i} in "${this.arrayFieldName}" is missing required field "${field}"${filePath ? ` in ${filePath}` : ''}`, {
                        filePath,
                        arrayFieldName: this.arrayFieldName,
                        itemIndex: i,
                        missingField: field,
                        timestamp: new Date()
                    });
                }
            }
        }
    }
    constructor(arrayFieldName, requiredFields){
        this.arrayFieldName = arrayFieldName;
        this.requiredFields = requiredFields;
    }
};
let NotEmptyValidator = class NotEmptyValidator {
    validate(content, filePath) {
        if (content === null || content === undefined || typeof content === 'object' && Object.keys(content).length === 0 || Array.isArray(content) && content.length === 0) {
            throw new _gameerrors.GameContentError(`Content cannot be empty${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                timestamp: new Date()
            });
        }
    }
};
let CompositeValidator = class CompositeValidator {
    validate(content, filePath) {
        for (const validator of this.validators){
            validator.validate(content, filePath);
        }
    }
    constructor(validators){
        this.validators = validators;
    }
};
function createGameContentValidators(version, arrayFieldName, requiredItemFields, minItems = 1) {
    return new CompositeValidator([
        new HasVersionValidator(version),
        new HasArrayValidator(arrayFieldName, minItems),
        new ArrayItemsValidator(arrayFieldName, requiredItemFields)
    ]);
}
