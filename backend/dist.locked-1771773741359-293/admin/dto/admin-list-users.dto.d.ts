export declare class AdminListUsersDto {
    search?: string;
    role?: string;
    status: 'all' | 'active' | 'banned';
    createdAfter?: string;
    createdBefore?: string;
    page: number;
    limit: number;
}
