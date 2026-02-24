import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { SocialProfileSettingsService } from '../../social/services/social-profile-settings.service';
export declare class AdminProfileWsHandler {
    private readonly validator;
    private readonly settings;
    constructor(validator: PayloadValidationService, settings: SocialProfileSettingsService);
    profileSettingsGet(session: WsSession, payload: any): {
        type: string;
        payload: import("../../social/services/social-profile-settings.service").SocialProfileSettings;
    };
    profileSettingsUpdate(session: WsSession, payload: any): Promise<{
        type: string;
        payload: import("../../social/services/social-profile-settings.service").SocialProfileSettings;
    }>;
}
