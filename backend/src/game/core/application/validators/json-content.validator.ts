import { GameContentError } from '../../domain/errors/game-errors';

export interface ContentValidator<T = unknown> {
  validate(content: T, filePath?: string): void;
}

export class HasVersionValidator implements ContentValidator {
  constructor(private readonly expectedVersion: number) {}

  validate(content: unknown, filePath?: string): void {
    if (!content || typeof content !== 'object') {
      throw new GameContentError(
        `Content must be an object${filePath ? ` in ${filePath}` : ''}`,
        { filePath, timestamp: new Date() },
      );
    }

    const version = (content as Record<string, unknown>).version;

    if (typeof version !== 'number') {
      throw new GameContentError(
        `Missing or invalid version field${filePath ? ` in ${filePath}` : ''}`,
        {
          filePath,
          expectedVersion: this.expectedVersion,
          timestamp: new Date(),
        },
      );
    }

    if (version !== this.expectedVersion) {
      throw new GameContentError(
        `Version mismatch: expected ${this.expectedVersion}, got ${version}${filePath ? ` in ${filePath}` : ''}`,
        {
          filePath,
          expectedVersion: this.expectedVersion,
          actualVersion: version,
          timestamp: new Date(),
        },
      );
    }
  }
}

export class HasArrayValidator implements ContentValidator {
  constructor(
    private readonly fieldName: string,
    private readonly minLength = 1,
  ) {}

  validate(content: unknown, filePath?: string): void {
    if (!content || typeof content !== 'object') {
      throw new GameContentError(
        `Content must be an object${filePath ? ` in ${filePath}` : ''}`,
        { filePath, timestamp: new Date() },
      );
    }

    const field = (content as Record<string, unknown>)[this.fieldName];

    if (!Array.isArray(field)) {
      throw new GameContentError(
        `Field "${this.fieldName}" must be an array${filePath ? ` in ${filePath}` : ''}`,
        { filePath, fieldName: this.fieldName, timestamp: new Date() },
      );
    }

    if (field.length < this.minLength) {
      throw new GameContentError(
        `Field "${this.fieldName}" must contain at least ${this.minLength} element(s), got ${field.length}${filePath ? ` in ${filePath}` : ''}`,
        {
          filePath,
          fieldName: this.fieldName,
          minLength: this.minLength,
          actualLength: field.length,
          timestamp: new Date(),
        },
      );
    }
  }
}

export class HasFieldValidator implements ContentValidator {
  constructor(
    private readonly fieldName: string,
    private readonly fieldType?:
      | 'string'
      | 'number'
      | 'boolean'
      | 'object'
      | 'array',
  ) {}

  validate(content: unknown, filePath?: string): void {
    if (!content || typeof content !== 'object') {
      throw new GameContentError(
        `Content must be an object${filePath ? ` in ${filePath}` : ''}`,
        { filePath, timestamp: new Date() },
      );
    }

    const field = (content as Record<string, unknown>)[this.fieldName];

    if (field === undefined || field === null) {
      throw new GameContentError(
        `Missing required field "${this.fieldName}"${filePath ? ` in ${filePath}` : ''}`,
        { filePath, fieldName: this.fieldName, timestamp: new Date() },
      );
    }

    if (this.fieldType) {
      const actualType = Array.isArray(field) ? 'array' : typeof field;

      if (actualType !== this.fieldType) {
        throw new GameContentError(
          `Field "${this.fieldName}" must be of type ${this.fieldType}, got ${actualType}${filePath ? ` in ${filePath}` : ''}`,
          {
            filePath,
            fieldName: this.fieldName,
            expectedType: this.fieldType,
            actualType,
            timestamp: new Date(),
          },
        );
      }
    }
  }
}

export class ArrayItemsValidator implements ContentValidator {
  constructor(
    private readonly arrayFieldName: string,
    private readonly requiredFields: string[],
  ) {}

  validate(content: unknown, filePath?: string): void {
    if (!content || typeof content !== 'object') {
      throw new GameContentError(
        `Content must be an object${filePath ? ` in ${filePath}` : ''}`,
        { filePath, timestamp: new Date() },
      );
    }

    const rawArray = (content as Record<string, unknown>)[this.arrayFieldName];

    if (!Array.isArray(rawArray)) {
      throw new GameContentError(
        `Field "${this.arrayFieldName}" must be an array${filePath ? ` in ${filePath}` : ''}`,
        { filePath, fieldName: this.arrayFieldName, timestamp: new Date() },
      );
    }
    const array: unknown[] = rawArray;

    for (let i = 0; i < array.length; i++) {
      const item = array[i];

      if (!item || typeof item !== 'object') {
        throw new GameContentError(
          `Item at index ${i} in "${this.arrayFieldName}" must be an object${filePath ? ` in ${filePath}` : ''}`,
          {
            filePath,
            arrayFieldName: this.arrayFieldName,
            itemIndex: i,
            timestamp: new Date(),
          },
        );
      }

      for (const field of this.requiredFields) {
        if (!Object.prototype.hasOwnProperty.call(item, field)) {
          throw new GameContentError(
            `Item at index ${i} in "${this.arrayFieldName}" is missing required field "${field}"${filePath ? ` in ${filePath}` : ''}`,
            {
              filePath,
              arrayFieldName: this.arrayFieldName,
              itemIndex: i,
              missingField: field,
              timestamp: new Date(),
            },
          );
        }
      }
    }
  }
}

export class NotEmptyValidator implements ContentValidator {
  validate(content: unknown, filePath?: string): void {
    if (
      content === null ||
      content === undefined ||
      (typeof content === 'object' && Object.keys(content).length === 0) ||
      (Array.isArray(content) && content.length === 0)
    ) {
      throw new GameContentError(
        `Content cannot be empty${filePath ? ` in ${filePath}` : ''}`,
        { filePath, timestamp: new Date() },
      );
    }
  }
}

export class CompositeValidator implements ContentValidator {
  constructor(private readonly validators: ContentValidator[]) {}

  validate(content: unknown, filePath?: string): void {
    for (const validator of this.validators) {
      validator.validate(content, filePath);
    }
  }
}

export function createGameContentValidators(
  version: number,
  arrayFieldName: string,
  requiredItemFields: string[],
  minItems = 1,
): ContentValidator {
  return new CompositeValidator([
    new HasVersionValidator(version),
    new HasArrayValidator(arrayFieldName, minItems),
    new ArrayItemsValidator(arrayFieldName, requiredItemFields),
  ]);
}
