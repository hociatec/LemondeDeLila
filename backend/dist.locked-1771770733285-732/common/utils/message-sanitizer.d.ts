export declare const DEFAULT_MESSAGE_MAX_LENGTH = 1000;
type SanitizeOptions = {
    encodeHtml?: boolean;
    collapseNewLines?: boolean;
    stripHtml?: boolean;
};
export declare function sanitizeMessage(raw: string, options?: SanitizeOptions): string;
export {};
