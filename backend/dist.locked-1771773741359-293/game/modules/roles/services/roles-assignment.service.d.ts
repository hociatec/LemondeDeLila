export declare class RolesAssignmentService {
    assign<T extends string>(playerIds: number[], prioritizedRoles: T[], defaultRole: T, rng?: () => number): Record<number, T>;
    private shuffle;
}
