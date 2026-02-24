import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type TaxiExpressGameId = 'taxi-express';
export type TaxiExpressPhaseId = 'turn';
export type TaxiExpressActionType = 'roll';
export declare const TAXI_EXPRESS_GAME: GameDefinition<TaxiExpressGameId, never, TaxiExpressActionType, TaxiExpressPhaseId, null>;
