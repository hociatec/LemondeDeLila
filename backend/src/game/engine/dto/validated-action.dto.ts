import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  Matches,
  ValidateNested,
  IsNumber,
  validate,
  ValidationError,
} from 'class-validator';
import { Type, plainToClass } from 'class-transformer';
import { PayloadValidationError } from '../../../common/errors/game-errors';

/**
 * Base DTO for action payloads
 */
export class GameActionPayloadDto {
  [key: string]: unknown;
}

/**
 * Validated DTO for a single game action
 */
export class ValidatedGameActionDto {
  @IsString()
  @IsNotEmpty({ message: 'Action type cannot be empty' })
  @Matches(/^[a-z0-9_-]+$/i, {
    message:
      'Action type must contain only alphanumeric characters, underscores, and hyphens',
  })
  type!: string;

  @IsOptional()
  @IsObject({ message: 'Payload must be an object' })
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject({ message: 'Meta must be an object' })
  meta?: Record<string, unknown>;
}

/**
 * Validated DTO for a list of game actions
 */
export class ValidatedGameActionListDto {
  @ValidateNested({ each: true })
  @Type(() => ValidatedGameActionDto)
  actions!: ValidatedGameActionDto[];
}

/**
 * Validates a single action DTO
 *
 * @param action - The action to validate
 * @param context - Additional context for error messages
 * @returns The validated action
 * @throws {PayloadValidationError} If validation fails
 */
export async function validateAction(
  action: unknown,
  context: Record<string, unknown> = {},
): Promise<ValidatedGameActionDto> {
  const dto = plainToClass(ValidatedGameActionDto, action);
  const errors = await validate(dto, {
    whitelist: false,
    forbidNonWhitelisted: false,
    validationError: { target: false },
  });

  if (errors.length > 0) {
    const errorMessages = formatValidationErrors(errors);
    throw new PayloadValidationError(
      `Action validation failed: ${errorMessages[0]}`,
      errorMessages,
      { ...context, action, timestamp: new Date() },
    );
  }

  return dto;
}

/**
 * Validates a list of actions
 *
 * @param actions - The actions to validate
 * @param context - Additional context for error messages
 * @returns The validated actions
 * @throws {PayloadValidationError} If validation fails
 */
export async function validateActions(
  actions: unknown,
  context: Record<string, unknown> = {},
): Promise<ValidatedGameActionDto[]> {
  if (!Array.isArray(actions)) {
    throw new PayloadValidationError(
      'Actions must be an array',
      ['Actions must be an array'],
      { ...context, actions, timestamp: new Date() },
    );
  }

  const validated: ValidatedGameActionDto[] = [];
  const allErrors: string[] = [];

  for (let i = 0; i < actions.length; i++) {
    try {
      const validatedAction = await validateAction(actions[i], {
        ...context,
        actionIndex: i,
      });
      validated.push(validatedAction);
    } catch (error) {
      if (error instanceof PayloadValidationError) {
        allErrors.push(`Action ${i}: ${error.message}`);
      } else {
        allErrors.push(`Action ${i}: Unknown validation error`);
      }
    }
  }

  if (allErrors.length > 0) {
    throw new PayloadValidationError(
      `Actions validation failed: ${allErrors.length} error(s)`,
      allErrors,
      { ...context, actions, timestamp: new Date() },
    );
  }

  return validated;
}

/**
 * Formats validation errors into readable messages
 */
function formatValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children && error.children.length > 0) {
      messages.push(...formatValidationErrors(error.children));
    }
  }

  return messages;
}

/**
 * Sanitizes an action by removing potentially dangerous properties
 */
export function sanitizeAction(
  action: ValidatedGameActionDto,
): ValidatedGameActionDto {
  const sanitized: ValidatedGameActionDto = {
    type: String(action.type).trim().toLowerCase(),
  };

  if (action.payload && typeof action.payload === 'object') {
    sanitized.payload = sanitizePayload(action.payload);
  }

  if (action.meta && typeof action.meta === 'object') {
    sanitized.meta = sanitizePayload(action.meta);
  }

  return sanitized;
}

/**
 * Sanitizes a payload object by removing dangerous properties and limiting depth
 */
function sanitizePayload(
  payload: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  const MAX_DEPTH = 5;
  const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

  if (depth > MAX_DEPTH) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    // Skip dangerous keys
    if (DANGEROUS_KEYS.includes(key)) {
      continue;
    }

    // Sanitize string keys
    const sanitizedKey = String(key).trim();
    if (!sanitizedKey || sanitizedKey.length > 100) {
      continue;
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizePayload(
        value as Record<string, unknown>,
        depth + 1,
      );
    } else if (Array.isArray(value)) {
      // Limit array length
      sanitized[sanitizedKey] = value.slice(0, 100).map((item) => {
        if (item && typeof item === 'object') {
          return sanitizePayload(item as Record<string, unknown>, depth + 1);
        }
        return item;
      });
    } else {
      // Primitive values are safe
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}
