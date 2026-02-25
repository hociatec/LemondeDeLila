export type ActionLogEntry = {
    step?: string;
    actorId: number | null;
    type: string;
    payload?: any;
    timestamp: number;
};
export declare class ActionLogService {
    append(log: ActionLogEntry[] | undefined, entry: Omit<ActionLogEntry, 'timestamp'>): ActionLogEntry[];
}
