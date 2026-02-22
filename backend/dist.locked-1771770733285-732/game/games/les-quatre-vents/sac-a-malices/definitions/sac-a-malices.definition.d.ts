import type { GameDefinition } from '../../../../engine/model/game-definition.model';
export type SacAMalicesGameId = 'sac-a-malices';
export type SacAMalicesPhaseId = 'turn';
export type SacAMalicesActionType = 'roll' | 'ROLL_DICE' | 'roll_dice' | 'buy' | 'skip_buy' | 'build' | 'sell_building' | 'mortgage' | 'unmortgage' | 'choose_property' | 'pay_fine' | 'use_jail_card' | 'sac_set_variant';
export declare const SAC_A_MALICES_GAME: GameDefinition<SacAMalicesGameId, never, SacAMalicesActionType, SacAMalicesPhaseId, null>;
