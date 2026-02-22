export interface ContentValidator<T = unknown> {
    validate(content: T, filePath?: string): void;
}
export declare class HasVersionValidator implements ContentValidator {
    private readonly expectedVersion;
    constructor(expectedVersion: number);
    validate(content: unknown, filePath?: string): void;
}
export declare class HasArrayValidator implements ContentValidator {
    private readonly fieldName;
    private readonly minLength;
    constructor(fieldName: string, minLength?: number);
    validate(content: unknown, filePath?: string): void;
}
export declare class HasFieldValidator implements ContentValidator {
    private readonly fieldName;
    private readonly fieldType?;
    constructor(fieldName: string, fieldType?: "string" | "number" | "boolean" | "object" | "array" | undefined);
    validate(content: unknown, filePath?: string): void;
}
export declare class ArrayItemsValidator implements ContentValidator {
    private readonly arrayFieldName;
    private readonly requiredFields;
    constructor(arrayFieldName: string, requiredFields: string[]);
    validate(content: unknown, filePath?: string): void;
}
export declare class NotEmptyValidator implements ContentValidator {
    validate(content: unknown, filePath?: string): void;
}
export declare class CompositeValidator implements ContentValidator {
    private readonly validators;
    constructor(validators: ContentValidator[]);
    validate(content: unknown, filePath?: string): void;
}
export declare function createGameContentValidators(version: number, arrayFieldName: string, requiredItemFields: string[], minItems?: number): ContentValidator;
