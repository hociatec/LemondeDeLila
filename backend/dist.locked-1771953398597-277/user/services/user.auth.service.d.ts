import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
export declare class UserAuthService {
    private readonly users;
    private readonly config;
    private readonly logger;
    private readonly jwtSigningKey;
    private readonly jwtAlgorithm;
    private readonly jwtExpiresIn;
    private readonly jwtIssuer;
    private readonly jwtAudience;
    constructor(users: Repository<User>, config: ConfigService);
    register(email: string, username: string, password: string): Promise<void>;
    login(username: string, password: string): Promise<{
        token: string;
    }>;
    private readonly _banReasonWhitespace;
    private sanitizeBanReason;
    private ensureUsernameAvailable;
    private ensureEmailAvailable;
}
