export declare function requiredInt(payload: unknown, key: string, message?: string): number;
export declare function optionalInt(payload: unknown, key: string): number | undefined;
export declare function requiredString(payload: unknown, key: string, message?: string): string;
export declare function optionalString(payload: unknown, key: string): string | undefined;
export declare function requiredEnumValue<T extends string>(payload: unknown, key: string, allowed: readonly T[], message?: string): T;
export declare function requiredArrayIndex(payload: unknown, key: string, length: number, message?: string): number;
