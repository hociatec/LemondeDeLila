import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
export declare class AdminPerfWsHandler {
    private readonly validator;
    private readonly perf;
    constructor(validator: PayloadValidationService, perf: PerfMetricsService);
    perfSnapshot(session: WsSession, payload: any): {
        type: string;
        payload: import("../../common/services/perf-metrics.service").PerfSnapshot;
    };
}
