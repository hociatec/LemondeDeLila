import { ConfigService } from '@nestjs/config';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
export declare class AdminLogsWsHandler {
    private readonly validator;
    private readonly config;
    constructor(validator: PayloadValidationService, config: ConfigService);
    logsDownload(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            file: string;
            lines: string[];
            total: number;
        };
    }>;
}
