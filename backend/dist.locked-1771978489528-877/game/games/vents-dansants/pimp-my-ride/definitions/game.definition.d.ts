import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type PimpMyRideActionType = 'play_card' | 'discard_card' | 'pass';
export type PimpMyRidePhaseId = 'round';
export declare const PIMP_MY_RIDE_GAME: GameDefinition<'pimp-my-ride', never, PimpMyRideActionType, PimpMyRidePhaseId, null>;
