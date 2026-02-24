import type { GameDefinition } from '../../../../engine/model/game-definition.model';
import { FOULEES_FANTASTIQUES_VICTORY } from './victory.definition';
export type FouleesFantastiquesGameId = 'foulees-fantastiques';
export type FouleesFantastiquesPhaseId = 'turn';
export type FouleesFantastiquesActionType = 'roll' | 'ROLL_DICE' | 'roll_dice' | 'choose_family' | 'move_pawn';
export declare const FOULEES_FANTASTIQUES_GAME: GameDefinition<FouleesFantastiquesGameId, never, FouleesFantastiquesActionType, FouleesFantastiquesPhaseId, typeof FOULEES_FANTASTIQUES_VICTORY>;
