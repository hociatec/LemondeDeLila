type AnyAction = {
    type?: unknown;
    label?: unknown;
    payload?: any;
};
export declare class GridCellActionsService {
    buildFromActions(actionsRaw: unknown, resolveLabel?: (action: AnyAction) => string): Record<string, Array<{
        type: string;
        label: string;
        payload: any;
    }>>;
}
export {};
