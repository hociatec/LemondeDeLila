import { UserAuthService } from '../services/user.auth.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
export declare class AuthWsHandler {
    private readonly auth;
    private readonly validator;
    constructor(auth: UserAuthService, validator: PayloadValidationService);
    register(payload: any): Promise<{
        type: string;
        payload: {
            message: string;
        };
    }>;
    login(payload: any): Promise<{
        type: string;
        payload: {
            token: string;
        };
    }>;
}
