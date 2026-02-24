import { UserService } from '../services/user.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
export declare class UserWsHandler {
    private readonly users;
    private readonly validator;
    constructor(users: UserService, validator: PayloadValidationService);
    list(): Promise<{
        type: string;
        payload: {
            items: import("../entities/user.entity").User[];
        };
    }>;
    get(payload: any): Promise<{
        type: string;
        payload: {
            user: import("../entities/user.entity").User;
        };
    }>;
}
