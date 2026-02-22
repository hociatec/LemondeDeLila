import type { GameDefinition } from '../../../../engine/model/game-definition.model';
import { PANIER_EXPRESS_VICTORY } from './victory.definition';
export type PanierExpressGameId = 'panier-express';
export type PanierExpressPhaseId = 'turn' | 'check_victory';
export type PanierExpressActionType = 'roll' | 'ROLL_DICE' | 'roll_dice' | 'choose_pawn' | 'draw' | 'answer_quiz' | 'pick_choice' | 'exchange_choose_target' | 'exchange_choose_give' | 'exchange_accept' | 'exchange_refuse' | 'merchant_request_accept' | 'merchant_request_refuse' | 'skip_turn';
export declare const PANIER_EXPRESS_GAME: GameDefinition<PanierExpressGameId, never, PanierExpressActionType, PanierExpressPhaseId, typeof PANIER_EXPRESS_VICTORY>;
