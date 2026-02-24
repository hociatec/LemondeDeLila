export declare class AdminCreateUserDto {
    email: string;
    username: string;
    password?: string;
    roles?: string[];
    avatar?: string | null;
    emailVerified?: boolean;
}
