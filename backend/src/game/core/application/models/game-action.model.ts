import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type { PendingState } from '../models/game-state.model';

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

/** Projection publique versionnée, distincte de l'état persistant interne. */
export interface GameStateWithActions {
  viewVersion: number;
  system: Record<string, unknown>;
  kits: Record<string, unknown>;
  effect: Record<string, unknown>;
  game: object;
  actions?: Array<{ type: string; label?: string; payload?: unknown }>;
  pending?: PendingState | null;
  actionCatalog?: readonly object[];
  timers?: Record<string, unknown>;
  [key: string]: unknown;
}
