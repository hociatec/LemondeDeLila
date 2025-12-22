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
} from '../../core/entities/game-state.entity';

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

// Étend la réponse d'état pour inclure les actions/pending exposées au client générique.
export interface GameStateWithActions extends GameStateEntity {
  actions?: Array<{ type: string; label?: string; payload?: any }>;
  pending?: PendingState | null;
  extras?: Record<string, unknown>;
}
