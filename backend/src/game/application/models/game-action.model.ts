import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { GameStateEntity, PendingState } from '../models/game-state.model';

export class GameSingleActionDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  label?: string;

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
  actions?: Array<{ type: string; label?: string; payload?: unknown }>;
  pending?: PendingState | null;
  extras?: Record<string, unknown>;
  catalog?: Record<string, unknown>;
  [key: string]: unknown;
}
