export declare class GameActionPayloadDto {
    [key: string]: unknown;
}
export declare class ValidatedGameActionDto {
    type: string;
    payload?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}
export declare class ValidatedGameActionListDto {
    actions: ValidatedGameActionDto[];
}
export declare function validateAction(action: unknown, context?: Record<string, unknown>): Promise<ValidatedGameActionDto>;
export declare function validateActions(actions: unknown, context?: Record<string, unknown>): Promise<ValidatedGameActionDto[]>;
export declare function sanitizeAction(action: ValidatedGameActionDto): ValidatedGameActionDto;
