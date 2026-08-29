import { StatsWsHandler } from '../infrastructure/presentation/ws/stats-ws.handler';
import { StatsWsRegistrar } from '../infrastructure/presentation/ws/stats-ws.registrar';

export const STATS_PRESENTATION_PROVIDERS = [StatsWsHandler, StatsWsRegistrar];
