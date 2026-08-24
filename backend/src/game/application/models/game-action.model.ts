import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  GameStateEntity,
  PendingState,
} from '../models/game-state.model';

export class GameSingleActionDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class GameActionListDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GameSingleActionDto)
  actions!: GameSingleActionDto[];
}

export type GameStateResponse = GameStateWithActions;

// Ã‰tend la rÃ©ponse d'Ã©tat pour inclure les actions/pending exposÃ©es au client gÃ©nÃ©rique.
export interface GameStateWithActions extends GameStateEntity {
  actions?: Array<{ type: string; label?: string; payload?: unknown }>;
  pending?: PendingState | null;
  extras?: Record<string, unknown>;
  catalog?: Record<string, unknown>;
  [key: string]: unknown;
}



