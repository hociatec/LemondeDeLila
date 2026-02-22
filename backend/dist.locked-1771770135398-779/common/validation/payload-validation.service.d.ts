export declare class PayloadValidationService {
    validate<T>(cls: new () => T, payload: unknown): T;
}
