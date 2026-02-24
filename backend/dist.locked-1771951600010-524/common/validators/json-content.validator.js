"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeValidator = exports.NotEmptyValidator = exports.ArrayItemsValidator = exports.HasFieldValidator = exports.HasArrayValidator = exports.HasVersionValidator = void 0;
exports.createGameContentValidators = createGameContentValidators;
const game_errors_1 = require("../errors/game-errors");
class HasVersionValidator {
    expectedVersion;
    constructor(expectedVersion) {
        this.expectedVersion = expectedVersion;
    }
    validate(content, filePath) {
        if (!content || typeof content !== 'object') {
            throw new game_errors_1.GameContentError(`Content must be an object${filePath ? ` in ${filePath}` : ''}`, { filePath, timestamp: new Date() });
        }
        const version = content.version;
        if (typeof version !== 'number') {
            throw new game_errors_1.GameContentError(`Missing or invalid version field${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                expectedVersion: this.expectedVersion,
                timestamp: new Date(),
            });
        }
        if (version !== this.expectedVersion) {
            throw new game_errors_1.GameContentError(`Version mismatch: expected ${this.expectedVersion}, got ${version}${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                expectedVersion: this.expectedVersion,
                actualVersion: version,
                timestamp: new Date(),
            });
        }
    }
}
exports.HasVersionValidator = HasVersionValidator;
class HasArrayValidator {
    fieldName;
    minLength;
    constructor(fieldName, minLength = 1) {
        this.fieldName = fieldName;
        this.minLength = minLength;
    }
    validate(content, filePath) {
        if (!content || typeof content !== 'object') {
            throw new game_errors_1.GameContentError(`Content must be an object${filePath ? ` in ${filePath}` : ''}`, { filePath, timestamp: new Date() });
        }
        const field = content[this.fieldName];
        if (!Array.isArray(field)) {
            throw new game_errors_1.GameContentError(`Field "${this.fieldName}" must be an array${filePath ? ` in ${filePath}` : ''}`, { filePath, fieldName: this.fieldName, timestamp: new Date() });
        }
        if (field.length < this.minLength) {
            throw new game_errors_1.GameContentError(`Field "${this.fieldName}" must contain at least ${this.minLength} element(s), got ${field.length}${filePath ? ` in ${filePath}` : ''}`, {
                filePath,
                fieldName: this.fieldName,
                minLength: this.minLength,
                actualLength: field.length,
                timestamp: new Date(),
            });
        }
    }
}
exports.HasArrayValidator = HasArrayValidator;
class HasFieldValidator {
    fieldName;
    fieldType;
    constructor(fieldName, fieldType) {
        this.fieldName = fieldName;
        this.fieldType = fieldType;
    }
    validate(content, filePath) {
        if (!content || typeof content !== 'object') {
            throw new game_errors_1.GameContentError(`Content must be an object${filePath ? ` in ${filePath}` : ''}`, { filePath, timestamp: new Date() });
        }
        const field = content[this.fieldName];
        if (field === undefined || field === null) {
            throw new game_errors_1.GameContentError(`Missing required field "${this.fieldName}"${filePath ? ` in ${filePath}` : ''}`, { filePath, fieldName: this.fieldName, timestamp: new Date() });
        }
        if (this.fieldType) {
            const actualType = Array.isArray(field) ? 'array' : typeof field;
            if (actualType !== this.fieldType) {
                throw new game_errors_1.GameContentError(`Field "${this.fieldName}" must be of type ${this.fieldType}, got ${actualType}${filePath ? ` in ${filePath}` : ''}`, {
                    filePath,
                    fieldName: this.fieldName,
                    expectedType: this.fieldType,
                    actualType,
                    timestamp: new Date(),
                });
            }
        }
    }
}
exports.HasFieldValidator = HasFieldValidator;
class ArrayItemsValidator {
    arrayFieldName;
    requiredFields;
    constructor(arrayFieldName, requiredFields) {
        this.arrayFieldName = arrayFieldName;
        this.requiredFields = requiredFields;
    }
    validate(content, filePath) {
        if (!content || typeof content !== 'object') {
            throw new game_errors_1.GameContentError(`Content must be an object${filePath ? ` in ${filePath}` : ''}`, { filePath, timestamp: new Date() });
        }
        const rawArray = content[this.arrayFieldName];
        if (!Array.isArray(rawArray)) {
            throw new game_errors_1.GameContentError(`Field "${this.arrayFieldName}" must be an array${filePath ? ` in ${filePath}` : ''}`, { filePath, fieldName: this.arrayFieldName, timestamp: new Date() });
        }
        const array = rawArray;
        for (let i = 0; i < array.length; i++) {
            const item = array[i];
            if (!item || typeof item !== 'object') {
                throw new game_errors_1.GameContentError(`Item at index ${i} in "${this.arrayFieldName}" must be an object${filePath ? ` in ${filePath}` : ''}`, {
                    filePath,
                    arrayFieldName: this.arrayFieldName,
                    itemIndex: i,
                    timestamp: new Date(),
                });
            }
            for (const field of this.requiredFields) {
                if (!Object.prototype.hasOwnProperty.call(item, field)) {
                    throw new game_errors_1.GameContentError(`Item at index ${i} in "${this.arrayFieldName}" is missing required field "${field}"${filePath ? ` in ${filePath}` : ''}`, {
                        filePath,
                        arrayFieldName: this.arrayFieldName,
                        itemIndex: i,
                        missingField: field,
                        timestamp: new Date(),
                    });
                }
            }
        }
    }
}
exports.ArrayItemsValidator = ArrayItemsValidator;
class NotEmptyValidator {
    validate(content, filePath) {
        if (content === null ||
            content === undefined ||
            (typeof content === 'object' && Object.keys(content).length === 0) ||
            (Array.isArray(content) && content.length === 0)) {
            throw new game_errors_1.GameContentError(`Content cannot be empty${filePath ? ` in ${filePath}` : ''}`, { filePath, timestamp: new Date() });
        }
    }
}
exports.NotEmptyValidator = NotEmptyValidator;
class CompositeValidator {
    validators;
    constructor(validators) {
        this.validators = validators;
    }
    validate(content, filePath) {
        for (const validator of this.validators) {
            validator.validate(content, filePath);
        }
    }
}
exports.CompositeValidator = CompositeValidator;
function createGameContentValidators(version, arrayFieldName, requiredItemFields, minItems = 1) {
    return new CompositeValidator([
        new HasVersionValidator(version),
        new HasArrayValidator(arrayFieldName, minItems),
        new ArrayItemsValidator(arrayFieldName, requiredItemFields),
    ]);
}
//# sourceMappingURL=json-content.validator.js.map